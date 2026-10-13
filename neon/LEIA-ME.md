# ZFlip 2.0, estrutura paralela

**Status em 13/10/2026: publicado e em produção**, em `https://zflip.zurirealestate.com`, separado do app antigo (`zflip-eosin.vercel.app`, continua intacto). Projeto Vercel `zflip2.0`, branch `zflip2-neon`.

## O que mudou em relação ao app antigo (Supabase)

- **Banco**: Supabase Postgres trocado pelo Neon. `api/_lib/supabase.js` saiu, entrou `api/_lib/db.js` (cliente `@neondatabase/serverless`, variável `DATABASE_URL`). `api/negocio.js`, `api/pdf.js` e `api/email.js` usam SQL direto. Schema em `neon/001_schema.sql`.
- **Armazenamento de arquivo**: Supabase Storage trocado pelo Vercel Blob (`api/_lib/armazenamento.js`), ponte temporária até o SharePoint ser liberado pelo TI (ver seção abaixo). Store `zflip2.0-blob`, acesso Público (precisa ser público, o link do PDF é compartilhado por WhatsApp/e-mail sem token).
- **RLS**: não existe fora do Supabase. Sem login nem leitura pública, o controle de acesso é "só a função do servidor, com a `DATABASE_URL` secreta, acessa o banco".
- **Reforço de segurança (auditoria de 12/10)**: `api/blob-upload.js` confere, antes de emitir o token de upload, que o caminho pedido pertence a um negócio que existe de verdade no banco.
- **E-mail**: remetente `Zuri Propostas <propostas@zurirealestate.pt>`. Toda proposta enviada vai com `cc` e `replyTo` para `financeiro@zurire.com` (propostas@ só encaminha, não tem caixa própria).

## O que já está feito

1. **Neon**: projeto `zflip2.0` criado, região Londres (AWS eu-west-2), schema aplicado e conferido.
2. **Vercel**: projeto `zflip2.0` criado a partir da branch `zflip2-neon`, Branch Tracking de Production apontando certo (não para `main`), `DATABASE_URL` configurada.
3. **Vercel Blob**: Store `zflip2.0-blob` (Público) ligado ao projeto, `BLOB_READ_WRITE_TOKEN` configurada.
4. **Domínio**: `zflip.zurirealestate.com` cadastrado, DNS (CNAME na OVH) e certificado SSL confirmados, HTTPS funcionando.
5. **Resend**: domínio `zurirealestate.pt` verificado (DKIM, SPF, DMARC, região eu-west-1, sem MX, só envio).
6. **Testado de ponta a ponta em 13/10**: criar negócio, gerar PDF, enviar e-mail, tudo confirmado funcionando via chamadas diretas à API em produção.

## O que falta

- **Rodar no SQL Editor do Neon** (ainda pendente, o usuário vai fazer): apagar o negócio de teste e reiniciar a numeração em 6, já que existem 5 propostas no sistema antigo.
  ```sql
  delete from public.negocios where id = '0e3c89ee-888d-45bd-acf9-d3e8cda4b4b0';
  alter sequence public.negocios_numero_seq restart with 6;
  ```
- **Apagar as chaves antigas do Resend** no painel (a chave original, que tinha um caractere inválido colado nela, e a "v2" trocada em seguida), depois de confirmar que a chave mais nova funciona.
- Testar no iPhone e Android: fotos, WhatsApp, Abrir/Compartilhar PDF (herdado do app antigo, nunca confirmado lá nem aqui). Instalar como PWA: abrir o site, "Adicionar à Tela de Início" (iPhone) ou "Adicionar à tela inicial" (Android).
- Migrar os poucos negócios de teste do Supabase antigo, se fizer sentido manter histórico.
- Decidir quando desligar de vez o projeto Supabase/Vercel antigo.

## SharePoint, quando o TI liberar

A pasta raiz **"Zuri - Propostas"** já existe no SharePoint da Zuri. Quando o Graph estiver liberado, cada proposta cria uma subpasta dentro dela, nomeada pela própria tag (`0006_Zuri_2026.10.13_NomeDoImovel`), com fotos, documentos e o PDF final.

No código, só `api/_lib/armazenamento.js` muda: as três funções (`subirArquivo`, `baixarComoBuffer`, `caminhoParaUpload`) passam a chamar o Microsoft Graph em vez do Vercel Blob. `api/negocio.js`, `api/pdf.js` e `api/email.js` não mudam, porque só conhecem essas três funções.

**O que pedir ao TI** (duas partes, a segunda não dá para fazer só pelo portal):

**Parte 1, no portal do Entra (entra.microsoft.com), alguém com permissão de administrador:**
1. Identity > Applications > App registrations > New registration
2. Nome: `ZFlip - Acesso SharePoint`
3. Supported account types: Accounts in this organizational directory only (só a Zuri)
4. Redirect URI: em branco (acesso de aplicativo, sem usuário logando)
5. Register
6. Anotar: Application (client) ID e Directory (tenant) ID
7. Certificates & secrets > New client secret, validade 12 ou 24 meses, copiar o Value na hora (some depois)
8. API permissions > Add a permission > Microsoft Graph > Application permissions > buscar `Sites` > marcar `Sites.Selected` > Add permissions
9. Grant admin consent for Zuri

**Parte 2, autorizar o aplicativo na pasta específica (Graph Explorer, alguém com acesso de admin ao site do SharePoint):**
1. developer.microsoft.com/graph/graph-explorer, logar como admin
2. `GET` para achar o ID do site onde fica "Zuri - Propostas"
3. `POST` nesse site, concedendo permissão `write` ao `Application (client) ID` da Parte 1

Quando o TI devolver Client ID, Tenant ID e Client Secret, a troca do código fica pronta em poucas horas.
