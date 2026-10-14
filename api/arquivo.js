// Serve o PDF da proposta pelo próprio domínio do ZFlip, lendo do SharePoint
// com as credenciais do app (api/_lib/graph.js). Sem isso, o link enviado por
// e-mail ou WhatsApp pediria login de conta Microsoft da Zuri, e quem recebe a
// proposta (cliente, investidor) normalmente não tem uma.
import { erro, idValido } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { baixarComoBuffer } from './_lib/armazenamento.js';
import { nomeDeArquivo } from './_lib/nome.js';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!idValido(id)) return erro('Identificador do negócio inválido');

  const db = sql();
  const [negocio] = await db`select nome, tag, pdf_path from public.negocios where id = ${id}`;
  if (!negocio || !negocio.pdf_path) return erro('Proposta não encontrada', 404);

  const bytes = await baixarComoBuffer(negocio.pdf_path);
  if (!bytes) return erro('PDF não encontrado no armazenamento', 404);

  return new Response(bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${nomeDeArquivo(negocio)}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
