import { PDFDocument } from 'pdf-lib';

const A4 = [595.28, 841.89];
const MARGEM = 36;

export function nomeDoCaminho(caminho) {
  // caminho: <id>/documentos/<n>-<nome>
  return caminho.split('/').pop().replace(/^\d+-/, '');
}

const EXT_TEXTO = ['txt', 'csv', 'md'];
const LIMITE_TEXTO = 300000; // caracteres; acima disso o texto é truncado

function extensao(nome) {
  return nome.includes('.') ? nome.split('.').pop().toLowerCase() : '';
}

function decodificar(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

// Estados de cada documento na lista da proposta.
export const ESTADO = { INCLUIDO: 'incluido', NAO_SUPORTADO: 'nao_suportado', FALHOU: 'falhou' };

// Acrescenta ao PDF de anexos as páginas de um documento. PDF entra página a
// página, PNG e JPG entram ajustados a uma página A4, e texto (TXT, CSV, MD) é
// diagramado em páginas pelo Chromium. Outros formatos (Word, Excel, HEIC,
// WebP) não dá para embutir e ficam só listados.
async function acrescentar(anexos, nome, bytes, renderizarTexto) {
  const ext = extensao(nome);
  if (ext === 'pdf' || EXT_TEXTO.includes(ext)) {
    let pdf = bytes;
    if (ext !== 'pdf') {
      let texto = decodificar(bytes);
      if (texto.length > LIMITE_TEXTO) texto = texto.slice(0, LIMITE_TEXTO) + '\n\n[conteúdo truncado]';
      pdf = await renderizarTexto(nome, texto);
    }
    const origem = await PDFDocument.load(pdf, { ignoreEncryption: true });
    const paginas = await anexos.copyPages(origem, origem.getPageIndices());
    paginas.forEach(p => anexos.addPage(p));
    return true;
  }
  if (['png', 'jpg', 'jpeg'].includes(ext)) {
    const img = ext === 'png' ? await anexos.embedPng(bytes) : await anexos.embedJpg(bytes);
    const pagina = anexos.addPage(A4);
    const escala = Math.min((A4[0] - 2 * MARGEM) / img.width, (A4[1] - 2 * MARGEM) / img.height, 1);
    const w = img.width * escala;
    const h = img.height * escala;
    pagina.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
    return true;
  }
  return false;
}

// arquivos: [{ nome, bytes }]. Devolve os anexos prontos e o estado de cada documento.
export async function prepararAnexos(arquivos, renderizarTexto) {
  const anexos = await PDFDocument.create();
  const docs = [];
  for (const { nome, bytes } of arquivos) {
    let estado = ESTADO.NAO_SUPORTADO;
    if (!bytes) {
      estado = ESTADO.FALHOU; // upload não concluído
    } else {
      try {
        estado = (await acrescentar(anexos, nome, bytes, renderizarTexto)) ? ESTADO.INCLUIDO : ESTADO.NAO_SUPORTADO;
      } catch (e) {
        console.error('anexo não incluído', nome, e.message);
        estado = ESTADO.FALHOU;
      }
    }
    docs.push({ nome, estado });
  }
  return { anexos, docs };
}

// Junta o PDF da proposta com as páginas dos anexos, se houver.
export async function juntar(pdfProposta, anexos) {
  if (anexos.getPageCount() === 0) return pdfProposta;
  const final = await PDFDocument.load(pdfProposta);
  const paginas = await final.copyPages(anexos, anexos.getPageIndices());
  paginas.forEach(p => final.addPage(p));
  return Buffer.from(await final.save());
}
