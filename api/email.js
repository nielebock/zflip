import { Resend } from 'resend';
import { json, erro, lerJson, idValido } from './_lib/http.js';
import { supabaseAdmin, BUCKET } from './_lib/supabase.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Remetente de teste do Resend até o domínio da Zuri ser verificado.
const REMETENTE = process.env.RESEND_FROM || 'ZFlip Zuri Real Estate <onboarding@resend.dev>';

export async function POST(request) {
  const body = await lerJson(request);
  if (!body || !idValido(body.id)) return erro('Identificador do negócio inválido');
  const para = typeof body.para === 'string' ? body.para.trim() : '';
  if (!EMAIL.test(para)) return erro('E-mail do destinatário inválido');

  const sb = supabaseAdmin();
  const { data: negocio, error } = await sb.from('negocios').select('id, pdf_path').eq('id', body.id).single();
  if (error || !negocio) return erro('Negócio não encontrado', 404);
  if (!negocio.pdf_path) return erro('Gere o PDF antes de enviar por e-mail', 409);

  const { data: arquivo, error: erroDownload } = await sb.storage.from(BUCKET).download(negocio.pdf_path);
  if (erroDownload || !arquivo) return erro('PDF não encontrado no Storage', 404);
  const conteudo = Buffer.from(await arquivo.arrayBuffer());

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error: erroEnvio } = await resend.emails.send({
    from: REMETENTE,
    to: [para],
    subject: 'Proposta de flip imobiliário, Zuri Real Estate',
    text: [
      'Olá,',
      '',
      'Segue em anexo a folha de proposta do negócio analisado pela Zuri Real Estate.',
      '',
      `Identificador do negócio: ${negocio.id}`,
      '',
      'Atenciosamente,',
      'Zuri Real Estate',
    ].join('\n'),
    attachments: [{ filename: `proposta-zflip-${negocio.id.slice(0, 8)}.pdf`, content: conteudo }],
  });

  if (erroEnvio) {
    console.error('resend', erroEnvio);
    return erro(`Falha no envio do e-mail: ${erroEnvio.message || 'erro desconhecido'}`, 502);
  }
  return json({ enviado: true, emailId: data?.id });
}
