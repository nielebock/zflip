import { handleUpload } from '@vercel/blob/client';
import { sql } from './_lib/db.js';

const TIPOS_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Caminho tem que ser <id-do-negócio>/fotos|miniaturas|documentos/<n>-<arquivo>,
// exatamente como api/negocio.js reserva. Evita emitir token para sobrescrever
// o caminho de um negócio que não é o que acabou de ser criado.
const FORMATO_CAMINHO = /^([0-9a-f-]{36})\/(fotos|miniaturas|documentos)\/\d+-[^/]+$/i;

async function negocioExiste(id) {
  const db = sql();
  const [linha] = await db`select 1 from public.negocios where id = ${id}`;
  return Boolean(linha);
}

// Emite o token de upload direto do celular para o Vercel Blob, para cada
// caminho que api/negocio.js já reservou (sem passar pelo limite de 4,5 MB da Vercel).
export async function POST(request) {
  const body = await request.json();
  try {
    const resposta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async pathname => {
        const m = FORMATO_CAMINHO.exec(pathname);
        if (!m || !(await negocioExiste(m[1]))) throw new Error('Caminho de upload inválido');
        return {
          allowedContentTypes: TIPOS_PERMITIDOS,
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: false,
        };
      },
    });
    return new Response(JSON.stringify(resposta), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
}
