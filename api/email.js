import { Resend } from 'resend';
import { json, erro, lerJson, idValido } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { baixarComoBuffer } from './_lib/armazenamento.js';
import { nomeDeArquivo } from './_lib/nome.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Remetente de teste do Resend até o domínio da Zuri ser verificado.
const REMETENTE = process.env.RESEND_FROM || 'ZFlip Zuri Real Estate <onboarding@resend.dev>';

export async function POST(request) {
  const body = await lerJson(request);
  if (!body || !idValido(body.id)) return erro('Identificador do negócio inválido');
  const para = typeof body.para === 'string' ? body.para.trim() : '';
  if (!EMAIL.test(para)) return erro('E-mail do destinatário inválido');

  const db = sql();
  const [negocio] = await db`select id, nome, tag, pdf_path from public.negocios where id = ${body.id}`;
  if (!negocio) return erro('Negócio não encontrado', 404);
  if (!negocio.pdf_path) return erro('Gere o PDF antes de enviar por e-mail', 409);

  const conteudo = await baixarComoBuffer(negocio.pdf_path);
  if (!conteudo) return erro('PDF não encontrado no armazenamento', 404);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error: erroEnvio } = await resend.emails.send({
    from: REMETENTE,
    to: [para],
    subject: negocio.nome ? `Proposta de flip imobiliário: ${negocio.nome}` : 'Proposta de flip imobiliário, Zuri Real Estate',
    text: [
      'Olá,',
      '',
      negocio.nome
        ? `Segue em anexo a folha de proposta do imóvel "${negocio.nome}", analisado pela Zuri Real Estate.`
        : 'Segue em anexo a folha de proposta do negócio analisado pela Zuri Real Estate.',
      '',
      `Identificador do negócio: ${negocio.id}`,
      '',
      'Atenciosamente,',
      'Zuri Real Estate',
    ].join('\n'),
    attachments: [{ filename: `${nomeDeArquivo(negocio)}.pdf`, content: conteudo }],
  });

  if (erroEnvio) {
    console.error('resend', erroEnvio);
    return erro(`Falha no envio do e-mail: ${erroEnvio.message || 'erro desconhecido'}`, 502);
  }
  return json({ enviado: true, emailId: data?.id });
}
