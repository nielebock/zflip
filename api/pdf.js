import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { json, erro, lerJson, idValido } from './_lib/http.js';
import { supabaseAdmin, BUCKET } from './_lib/supabase.js';
import { renderProposta } from './_lib/proposta.js';
import { nomeDoCaminho, prepararAnexos, juntar } from './_lib/anexos.js';
import { nomeDeArquivo } from './_lib/nome.js';

chromium.setGraphicsMode = false;

const VALIDADE_LINK = 60 * 60 * 24 * 7; // 7 dias, para o link enviado pelo WhatsApp

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

async function baixarComoDataUri(sb, caminho) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error || !data) return null; // upload não concluído: a foto fica de fora
  const buf = Buffer.from(await data.arrayBuffer());
  return `data:${data.type || 'image/jpeg'};base64,${buf.toString('base64')}`;
}

async function baixarBytes(sb, caminho) {
  const { data, error } = await sb.storage.from(BUCKET).download(caminho);
  if (error || !data) return null; // upload não concluído: o documento fica só listado
  return new Uint8Array(await data.arrayBuffer());
}

async function gerarPdf(html) {
  const browser = await abrirNavegador();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

export async function POST(request) {
  const body = await lerJson(request);
  if (!body || !idValido(body.id)) return erro('Identificador do negócio inválido');

  const sb = supabaseAdmin();
  const { data: negocio, error } = await sb.from('negocios').select('*').eq('id', body.id).single();
  if (error || !negocio) return erro('Negócio não encontrado', 404);

  try {
    const fotos = (await Promise.all((negocio.fotos || []).map(c => baixarComoDataUri(sb, c)))).filter(Boolean);
    const arquivos = await Promise.all((negocio.documentos || []).map(async c => ({
      nome: nomeDoCaminho(c),
      bytes: await baixarBytes(sb, c),
    })));
    const { anexos, docs } = await prepararAnexos(arquivos);
    const pdf = await juntar(await gerarPdf(renderProposta(negocio, fotos, docs)), anexos);

    const caminho = `${negocio.id}/proposta-zflip.pdf`;
    const { error: erroUpload } = await sb.storage.from(BUCKET)
      .upload(caminho, pdf, { contentType: 'application/pdf', upsert: true });
    if (erroUpload) throw erroUpload;

    await sb.from('negocios').update({ pdf_path: caminho }).eq('id', negocio.id);

    const { data: link, error: erroLink } = await sb.storage.from(BUCKET)
      .createSignedUrl(caminho, VALIDADE_LINK, { download: `${nomeDeArquivo(negocio)}.pdf` });
    if (erroLink) throw erroLink;

    return json({ id: negocio.id, url: link.signedUrl });
  } catch (e) {
    console.error('gerar pdf', e);
    return erro('Não foi possível gerar o PDF', 500);
  }
}
