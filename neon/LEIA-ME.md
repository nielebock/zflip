# ZFlip 2.0, estrutura paralela (branch `zflip2-neon`)

Não mexe no app em produção (branch `main`, projeto Vercel `zflip`, Supabase `ZFlipDB`). É uma cópia do código, trocando o banco e o armazenamento de arquivo, para rodar como um segundo app (`zflip2`, projeto novo na Vercel, banco novo no Neon), testada e comparada antes de decidir migrar de vez.

## O que mudou em relação ao `main`

- **Banco**: Supabase Postgres trocado pelo Neon. `api/_lib/supabase.js` saiu, entrou `api/_lib/db.js` (cliente `@neondatabase/serverless`, variável `DATABASE_URL`). `api/negocio.js`, `api/pdf.js` e `api/email.js` passaram a usar SQL direto, sem o cliente do `supabase-js`. Schema consolidado das 5 migrações do Supabase em `neon/001_schema.sql`.
- **Armazenamento de arquivo**: Supabase Storage trocado pelo Vercel Blob (`api/_lib/armazenamento.js`), como ponte temporária até o SharePoint ser liberado pelo TI (ver seção abaixo). O celular sobe fotos e documentos direto para o Blob, usando um token emitido por `api/blob-upload.js` (`@vercel/blob/client`, importado por `js/exportar.js`).
- **RLS**: não existe fora do Supabase. Como não há login nem leitura pública nesta fase, o controle de acesso segue sendo "só a função do servidor, com a `DATABASE_URL` secreta, acessa o banco".

Testado localmente (Postgres local, mesma query do `api/negocio.js`): schema aplica sem erro, numeração sequencial e tag funcionam igual ao Supabase. **Não testado** contra um Neon ou Vercel Blob reais, porque esta sessão não tem credenciais para criar esses recursos.

**Reforço de segurança (auditoria de 12/10):** `api/blob-upload.js` agora confere, antes de emitir o token de upload, que o caminho pedido tem o formato esperado (`<id>/fotos|miniaturas|documentos/<n>-<arquivo>`) e que esse `<id>` corresponde a um negócio que existe de verdade no banco. Isso impede que alguém peça um token para sobrescrever o arquivo de outro negócio direto pela API, sem passar pelo fluxo normal do app.

## O que falta para publicar o ZFlip 2.0

Nada disso eu consigo fazer sozinho: preciso de contas e de confirmação de pagamento (mesmo em plano gratuito), e esta sessão não tem acesso a elas. São 4 passos, nessa ordem.

### 1. Criar o banco no Neon
1. Entrar em neon.tech, criar conta (dá para usar login do GitHub) e criar um projeto novo, nome sugerido `zflip`.
2. Na aba **SQL Editor** do projeto, colar o conteúdo de `neon/001_schema.sql` e rodar.
3. Na aba **Connection string** (ou **Dashboard**), copiar a URL que começa com `postgres://` ou `postgresql://`. Essa é a `DATABASE_URL`, guardar para o passo 3.

### 2. Criar o projeto novo na Vercel
1. Na Vercel, **Add New > Project**, importar o repositório `nielebock/zflip`, mas apontando para a branch `zflip2-neon` (não `main`). Nome sugerido do projeto: `zflip2`.
2. Isso cria um endereço novo (tipo `zflip2-algumacoisa.vercel.app`), separado do `zflip-eosin.vercel.app` atual, que continua no ar sem mudança nenhuma.

### 3. Criar o Vercel Blob Store e configurar as variáveis
1. Dentro do projeto `zflip2` recém criado, ir em **Storage > Create Database > Blob**. Ao conectar o Blob Store ao projeto, a Vercel cria sozinha a variável `BLOB_READ_WRITE_TOKEN`, não precisa copiar nada manualmente.
2. Em **Settings > Environment Variables**, adicionar:
   - `DATABASE_URL`: a connection string do Neon (passo 1.3), em Production e Preview
   - `RESEND_API_KEY` e `RESEND_FROM`: as mesmas do projeto `zflip` atual (ou novas chaves, se preferir manter o Resend separado por ambiente)
3. Republicar o projeto (**Deployments > Redeploy** no último commit) para as variáveis novas entrarem em vigor.

### 4. Testar de ponta a ponta
Abrir o endereço novo (`zflip2-...vercel.app`), preencher um negócio de teste, gerar o PDF, enviar por e-mail, conferir no Neon (`select numero, tag, nome from public.negocios order by numero;`) e no painel do Vercel Blob que os arquivos apareceram.

Quando terminar o passo 1, me manda a `DATABASE_URL` só por variável de ambiente da Vercel (nunca aqui na conversa) e eu confirmo se o schema rodou certo e sigo testando o que der, mas o preenchimento das contas (Neon, Vercel, Blob Store) é algo que só você consegue fazer, por exigir login.

## SharePoint, quando o TI liberar

Quando o registro no Entra ID estiver aprovado (permissão `Sites.Selected`, restrita à biblioteca da Zuri), só `api/_lib/armazenamento.js` muda: as três funções (`subirArquivo`, `baixarComoBuffer`, `caminhoParaUpload`) passam a chamar o Microsoft Graph em vez do Vercel Blob. `api/negocio.js`, `api/pdf.js` e `api/email.js` não precisam mudar, porque só conhecem essas três funções, não o Blob diretamente.
