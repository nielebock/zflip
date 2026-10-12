import { handleUpload } from '@vercel/blob/client';

const TIPOS_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Emite o token de upload direto do celular para o Vercel Blob, para cada
// caminho que api/negocio.js já reservou (sem passar pelo limite de 4,5 MB da Vercel).
export async function POST(request) {
  const body = await request.json();
  try {
    const resposta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: TIPOS_PERMITIDOS,
        maximumSizeInBytes: 50 * 1024 * 1024,
        addRandomSuffix: false,
      }),
    });
    return new Response(JSON.stringify(resposta), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
}
