import { PDFDocument } from 'pdf-lib';

const A4 = [595.28, 841.89];
const MARGEM = 36;

export function nomeDoCaminho(caminho) {
  // caminho: <id>/documentos/<n>-<nome>
  return caminho.split('/').pop().replace(/^\d+-/, '');
}

function extensao(nome) {
  return nome.includes('.') ? nome.split('.').pop().toLowerCase() : '';
}

// Acrescenta ao PDF de anexos as páginas de um documento. PDF entra página a
// página, PNG e JPG entram ajustados a uma página A4. Outros formatos (Word,
// Excel, HEIC, WebP) não dá para embutir e ficam só listados.
async function acrescentar(anexos, nome, bytes) {
  const ext = extensao(nome);
  if (ext === 'pdf') {
    const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
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

// arquivos: [{ nome, bytes }]. Devolve os anexos prontos e o status de cada documento.
export async function prepararAnexos(arquivos) {
  const anexos = await PDFDocument.create();
  const docs = [];
  for (const { nome, bytes } of arquivos) {
    let incluido = false;
    if (bytes) {
      try {
        incluido = await acrescentar(anexos, nome, bytes);
      } catch (e) {
        console.error('anexo ignorado', nome, e.message);
      }
    }
    docs.push({ nome, incluido });
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
