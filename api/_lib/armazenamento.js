// Camada de armazenamento de arquivos do ZFlip 2.0: hoje usa o Vercel Blob, para
// o app funcionar sem o Supabase enquanto o SharePoint não é liberado pelo TI.
// Quando o registro no Entra ID estiver pronto, só este arquivo muda (trocar
// as três funções abaixo por chamadas ao Microsoft Graph); o resto do código
// (negocio.js, pdf.js, email.js) não conhece o Vercel Blob diretamente.
import { put, head, del } from '@vercel/blob';

// URL que o celular usa para enviar o arquivo direto ao armazenamento (sem passar
// pelo limite de 4,5 MB da Vercel). O Blob não tem signed upload URL como o
// Supabase; em vez disso devolve o próprio caminho e o token vai na função
// api/blob-upload.js, chamada pelo client do @vercel/blob/client no navegador.
export function caminhoParaUpload(caminho) {
  return { caminho };
}

export async function baixarComoBuffer(caminho) {
  try {
    const info = await head(caminho);
    const resp = await fetch(info.url);
    if (!resp.ok) return null;
    return Buffer.from(await resp.arrayBuffer());
  } catch {
    return null; // upload não concluído ou arquivo removido
  }
}

export async function subirArquivo(caminho, bytes, contentType) {
  const { url } = await put(caminho, bytes, { access: 'public', contentType, addRandomSuffix: false });
  return url;
}

export async function apagarArquivo(caminho) {
  await del(caminho).catch(() => {}); // melhor esforço, não impede o restante do fluxo
}
