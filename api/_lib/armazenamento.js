// Camada de armazenamento de arquivos do ZFlip 2.0.
// Fotos e documentos sobem do celular direto para o Vercel Blob (contorna o
// limite de 4,5 MB da função Vercel, que o Microsoft Graph não tem como
// contornar sem expor o segredo do app no celular). Quando o PDF é gerado,
// migrarParaSharePoint copia tudo (fotos, documentos, PDF) para a subpasta da
// proposta no SharePoint e apaga a cópia temporária do Blob.
// negocio.js e email.js só conhecem baixarComoBuffer e apagarArquivo; só este
// arquivo sabe que existem dois provedores por baixo.
import { put, head, del } from '@vercel/blob';
import { enviarArquivo, baixarArquivo, apagarArquivoGraph } from './graph.js';

export function caminhoParaUpload(caminho) {
  return { caminho };
}

async function baixarDoBlob(caminho) {
  try {
    const info = await head(caminho);
    const resp = await fetch(info.url);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null; // upload não concluído, arquivo removido, ou já migrado para o SharePoint
  }
}

export async function baixarComoBuffer(caminho) {
  const doBlob = await baixarDoBlob(caminho);
  if (doBlob) return doBlob;
  return baixarArquivo(caminho).catch(() => null);
}

// Usado só para o PDF final, gerado no servidor: vai direto para o SharePoint.
export async function subirArquivo(caminho, bytes, contentType) {
  return enviarArquivo(caminho, bytes, contentType);
}

export async function apagarArquivo(caminho) {
  await del(caminho).catch(() => {});
  await apagarArquivoGraph(caminho).catch(() => {});
}

// Copia um arquivo do Blob (onde o celular fez upload) para o caminho definitivo
// no SharePoint, e apaga a cópia temporária. Não falha o chamador: se o arquivo
// não existir mais no Blob (já migrado antes, ou nunca enviado), só retorna false.
export async function migrarParaSharePoint(caminhoAntigo, caminhoNovo) {
  const bytes = await baixarDoBlob(caminhoAntigo);
  if (!bytes) return false;
  await enviarArquivo(caminhoNovo, bytes);
  await del(caminhoAntigo).catch(() => {});
  return true;
}
