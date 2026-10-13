import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { json, erro, lerJson, idValido } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { baixarComoBuffer, subirArquivo } from './_lib/armazenamento.js';
import { renderProposta, renderTexto } from './_lib/proposta.js';
import { nomeDoCaminho, prepararAnexos, juntar } from './_lib/anexos.js';
import { nomeDeArquivo } from './_lib/nome.js';

chromium.setGraphicsMode = false;

// Na Vercel usa o Chromium do @sparticuz/chromium; localmente, o Chrome instalado.
async function abrirNavegador() {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
      executablePath: await chromium.executablePath(),
      headless: 'shell',
    });
  }
  return puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
}

// Fotos e miniaturas sempre chegam como JPEG (ver reduzirFoto em js/arquivos.js).
async function baixarComoDataUri(caminho) {
  const buf = await baixarComoBuffer(caminho);
  if (!buf) return null; // upload não concluído: a foto fica de fora
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

// Converte HTML em PDF numa página nova do navegador já aberto.
async function htmlParaPdf(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

export async function POST(request) {
  const body = await lerJson(request);
  if (!body || !idValido(body.id)) return erro('Identificador do negócio inválido');

  const db = sql();
  const [negocio] = await db`select * from public.negocios where id = ${body.id}`;
  if (!negocio) return erro('Negócio não encontrado', 404);

  try {
    // Negócios novos: miniaturas de todas as fotos na página 1 e só as principais grandes.
    // Negócios antigos (sem miniaturas): as fotos guardadas servem para os dois usos.
    const temMiniaturas = (negocio.miniaturas || []).length > 0;
    const caminhosGrandes = temMiniaturas ? (negocio.fotos_principais || []) : (negocio.fotos || []).slice(0, 4);
    const caminhosMiniaturas = temMiniaturas ? negocio.miniaturas : caminhosGrandes;
    const baixar = async lista => (await Promise.all(lista.map(baixarComoDataUri))).filter(Boolean);
    const fotos = { miniaturas: await baixar(caminhosMiniaturas), grandes: temMiniaturas ? await baixar(caminhosGrandes) : null };
    if (!fotos.grandes) fotos.grandes = fotos.miniaturas;
    const arquivos = await Promise.all((negocio.documentos || []).map(async c => ({
      nome: nomeDoCaminho(c),
      bytes: await baixarComoBuffer(c),
    })));
    const browser = await abrirNavegador();
    let pdf;
    try {
      const { anexos, docs } = await prepararAnexos(arquivos, (nome, texto) => htmlParaPdf(browser, renderTexto(nome, texto)));
      pdf = await juntar(await htmlParaPdf(browser, renderProposta(negocio, fotos, docs)), anexos);
    } finally {
      await browser.close();
    }

    const caminho = `${negocio.id}/${nomeDeArquivo(negocio)}.pdf`;
    const url = await subirArquivo(caminho, pdf, 'application/pdf');

    await db`update public.negocios set pdf_path = ${caminho} where id = ${negocio.id}`;

    return json({ id: negocio.id, url });
  } catch (e) {
    console.error('gerar pdf', e);
    return erro(`Não foi possível gerar o PDF: ${e?.message || e}`, 500); // DIAGNOSTICO TEMPORARIO
  }
}
