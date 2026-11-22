# ZFlip 2.0, estrutura paralela

**Status em 22/11/2026: em produção e testado de ponta a ponta com arquivos reais** (fotos, documentos, PDF, e-mail, SharePoint), em `https://zflip.zurirealestate.com`, separado do app antigo (`zflip-eosin.vercel.app`, continua intacto). Projeto Vercel `zflip2.0`, branch `zflip2-neon`. O usuário já não considera mais o app antigo (Supabase) relevante.

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

## SharePoint, em produção desde 14/10

Migração para o SharePoint concluída e testada de ponta a ponta (gerar PDF, migrar fotos/documentos, enviar e-mail lendo do SharePoint). `api/_lib/graph.js` fala com o Microsoft Graph (client credentials, permissão `Sites.Selected` só no site `ZURI-FINANCEIRO`). `api/_lib/armazenamento.js` orquestra: fotos e documentos sobem do celular para o Vercel Blob (contorna o limite de 4,5 MB da função), e ao gerar o PDF, `migrarParaSharePoint` copia tudo para a subpasta da proposta (nomeada pela tag, ex. `0006_Zuri_2026.10.14_NomeDoImovel`) dentro de **"ZURI - Novos Investimentos/ZURI - Propostas"**, no site `arjonholding.sharepoint.com/sites/ZURI-FINANCEIRO`, biblioteca "Documentos Compartilhados", e apaga a cópia temporária do Blob.

Variáveis em uso no Vercel: `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET` (Production e Preview).

**Dois erros reais encontrados e corrigidos no dia 14/10**, documentar para não repetir:
1. Bug de sintaxe em `api/pdf.js`: `const [fotos, ...]` da migração colidia com `const fotos` já usado para os dados do PDF, quebrava a função inteira (`FUNCTION_INVOCATION_FAILED` cru, sem chegar ao try/catch). Corrigido renomeando as variáveis da migração.
2. Confusão no e-mail do TI sobre qual campo é o segredo: o e-mail trazia "KEY" (formato `4JG8Q~dlwGYKlR...`, esse é o Secret Value de verdade) e "VALUE" (um GUID, que na realidade era o Secret ID). Os rótulos do e-mail do TI estavam trocados em relação aos nomes do portal do Entra. Além disso, um espaço ou quebra de linha colado junto ao secret causava `AADSTS7000215: Invalid client secret` mesmo com o valor certo (igual já tinha acontecido com o RESEND_API_KEY); `api/_lib/graph.js` agora aplica `.trim()` nas três variáveis por segurança.

## Dois bugs reais encontrados testando com arquivos de verdade no celular (14/10)

1. **Upload de foto/documento sempre falhava do celular**: `js/exportar.js` passava `addRandomSuffix: false` também no lado do cliente (`upload()` do `@vercel/blob/client`), e essa opção só pode vir do servidor (`api/blob-upload.js`, que já a define em `onBeforeGenerateToken`). A lib rejeitava com `client/upload doesn't allow addRandomSuffix`. Como o teste de 13/10 só usou `curl` sem fotos, esse bug nunca tinha sido exercido. Corrigido removendo a opção do lado do cliente.
2. **Link do PDF pedia login de conta Microsoft da Zuri**: `subirArquivo` devolvia a URL do SharePoint (`item.webUrl`) direto para o app, e quem recebe a proposta (cliente, investidor) não tem conta Microsoft da Zuri para abrir. Corrigido com `api/arquivo.js` (novo endpoint `GET /api/arquivo?id=...`), que busca o arquivo no SharePoint com as credenciais do app e serve pelo próprio domínio do ZFlip, sem exigir login de quem abre o link. `api/pdf.js` agora devolve essa URL, não a do SharePoint.

## Funcionalidades adicionadas depois do SharePoint (14/10 a 19/11)

- **Criado por**: campo novo na janela de nome do imóvel (antes de gerar o PDF), salvo em `public.negocios.criado_por`, lembrado no aparelho via `localStorage`. Aparece numa faixa abaixo do cabeçalho verde da folha de proposta (não mais no rodapé).
- **IMT desligado por padrão**: o botão "Aplicar IMT?" no formulário começa desmarcado (antes vinha marcado).
- **Área do imóvel (m²)**: campo opcional no formulário (`area_m2`, coluna nova em `public.negocios`). Quando preenchido, a tela e o PDF mostram duas linhas extras na tabela de contas: "Preço de venda por m²" e "Preço de compra por m²", calculadas para as duas colunas (preço máximo e preço informado). Sem área informada, essas linhas não aparecem.

## O que falta

- **Apagar as chaves antigas do Resend** no painel (a chave original, que tinha um caractere inválido colado nela, e a "v2" trocada em seguida), depois de confirmar que a chave mais nova funciona. Ainda não confirmado se foi feito.
- WhatsApp e Abrir/Compartilhar PDF no Android (testado e confirmado no iPhone; o fluxo é o mesmo, mas nunca confirmado num Android de verdade).
- Migrar os poucos negócios de teste do Supabase antigo, se fizer sentido manter histórico (usuário já não considera o app antigo relevante, pode não valer a pena).
- Decidir quando desligar de vez o projeto Supabase/Vercel antigo.
