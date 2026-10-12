# ZFlip 2.0, estrutura paralela (branch `zflip2-neon`)

Não mexe no app em produção (branch `main`, projeto Vercel `zflip`, Supabase `ZFlipDB`). É uma cópia do código, trocando o banco e o armazenamento de arquivo, para rodar como um segundo app (`zflip2`, projeto novo na Vercel, banco novo no Neon), testada e comparada antes de decidir migrar de vez.

## O que mudou em relação ao `main`

- **Banco**: Supabase Postgres trocado pelo Neon. `api/_lib/supabase.js` saiu, entrou `api/_lib/db.js` (cliente `@neondatabase/serverless`, variável `DATABASE_URL`). `api/negocio.js`, `api/pdf.js` e `api/email.js` passaram a usar SQL direto, sem o cliente do `supabase-js`. Schema consolidado das 5 migrações do Supabase em `neon/001_schema.sql`.
- **Armazenamento de arquivo**: Supabase Storage trocado pelo Vercel Blob (`api/_lib/armazenamento.js`), como ponte temporária até o SharePoint ser liberado pelo TI (ver seção abaixo). O celular sobe fotos e documentos direto para o Blob, usando um token emitido por `api/blob-upload.js` (`@vercel/blob/client`, importado por `js/exportar.js`).
- **RLS**: não existe fora do Supabase. Como não há login nem leitura pública nesta fase, o controle de acesso segue sendo "só a função do servidor, com a `DATABASE_URL` secreta, acessa o banco".

Testado localmente (Postgres local, mesma query do `api/negocio.js`): schema aplica sem erro, numeração sequencial e tag funcionam igual ao Supabase. **Não testado** contra um Neon ou Vercel Blob reais, porque esta sessão não tem credenciais para criar esses recursos.

## O que falta para publicar o ZFlip 2.0

1. **Criar o projeto no Neon** (neon.tech, tem plano gratuito): criar o banco, copiar a `DATABASE_URL`, rodar `neon/001_schema.sql` nele (pelo editor SQL do próprio Neon, igual se fazia no Supabase).
2. **Criar um Vercel Blob Store** no projeto novo da Vercel (Storage, aba Blob): gera sozinho a variável `BLOB_READ_WRITE_TOKEN`, não precisa configurar nada a mais.
3. **Criar o projeto novo na Vercel**, apontando para a branch `zflip2-neon`, com as variáveis: `DATABASE_URL` (Neon), `BLOB_READ_WRITE_TOKEN` (Blob, gerado sozinho), `RESEND_API_KEY` e `RESEND_FROM` (as mesmas do projeto atual, ou novas se preferir separar).
4. **Testar de ponta a ponta**: preencher um negócio, gerar PDF, enviar e-mail, no app novo publicado.

## SharePoint, quando o TI liberar

Quando o registro no Entra ID estiver aprovado (permissão `Sites.Selected`, restrita à biblioteca da Zuri), só `api/_lib/armazenamento.js` muda: as três funções (`subirArquivo`, `baixarComoBuffer`, `caminhoParaUpload`) passam a chamar o Microsoft Graph em vez do Vercel Blob. `api/negocio.js`, `api/pdf.js` e `api/email.js` não precisam mudar, porque só conhecem essas três funções, não o Blob diretamente.
