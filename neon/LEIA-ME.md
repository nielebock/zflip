# ZFlip 2.0, estrutura paralela

**Status em 13/10/2026: publicado e em produção**, em `https://zflip.zurirealestate.com`, separado do app antigo (`zflip-eosin.vercel.app`, continua intacto). Projeto Vercel `zflip2.0`, branch `zflip2-neon`.

## O que mudou em relação ao app antigo (Supabase)

- **Banco**: Supabase Postgres trocado pelo Neon. `api/_lib/supabase.js` saiu, entrou `api/_lib/db.js` (cliente `@neondatabase/serverless`, variável `DATABASE_URL`). `api/negocio.js`, `api/pdf.js` e `api/email.js` usam SQL direto. Schema em `neon/001_schema.sql`.
- **Armazenamento de arquivo**: Supabase Storage trocado pelo Vercel Blob (`api/_lib/armazenamento.js`), ponte temporária até o SharePoint ser liberado pelo TI (ver seção abaixo).
- **RLS**: não existe fora do Supabase. Sem login nem leitura pública, o controle de acesso é "só a função do servidor, com a `DATABASE_URL` secreta, acessa o banco".
- **Reforço de segurança (auditoria de 12/10)**: `api/blob-upload.js` confere, antes de emitir o token de upload, que o caminho pedido pertence a um negócio que existe de verdade no banco.

## O que já está feito

1. **Neon**: projeto `zflip2.0` criado, região Londres (AWS eu-west-2), schema aplicado e conferido.
2. **Vercel**: projeto `zflip2.0` criado a partir da branch `zflip2-neon`, Branch Tracking de Production apontando certo (não para `main`), `DATABASE_URL` configurada.
3. **Vercel Blob**: Store ligado ao projeto (`BLOB_READ_WRITE_TOKEN` automático).
4. **Domínio**: `zflip.zurirealestate.com` cadastrado, DNS (CNAME na OVH) e certificado SSL confirmados, HTTPS funcionando.
5. **Resend**: domínio `zurirealestate.pt` verificado (DKIM, SPF, DMARC, região eu-west-1, sem MX, só envio). Remetente `ZFlip <propostas@zurirealestate.pt>`, respostas vão para `financeiro@zurire.com` (`replyTo` no código). `RESEND_API_KEY` já configurada na Vercel.

## O que falta

- **Testar o envio de e-mail de ponta a ponta** com o domínio novo (implementado no código em 13/10, ainda não confirmado com um envio real).
- Testar no iPhone e Android: PDF, WhatsApp, fotos principais (herdado do app antigo, nunca confirmado lá nem aqui).
- Migrar os poucos negócios de teste do Supabase antigo, se fizer sentido manter histórico.
- Decidir quando desligar de vez o projeto Supabase/Vercel antigo.

## SharePoint, quando o TI liberar

Quando o registro no Entra ID estiver aprovado (permissão `Sites.Selected`, restrita à biblioteca da Zuri), só `api/_lib/armazenamento.js` muda: as três funções (`subirArquivo`, `baixarComoBuffer`, `caminhoParaUpload`) passam a chamar o Microsoft Graph em vez do Vercel Blob. `api/negocio.js`, `api/pdf.js` e `api/email.js` não mudam, porque só conhecem essas três funções.
