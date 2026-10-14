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

## SharePoint, em produção desde 14/10

Migração para o SharePoint concluída e testada de ponta a ponta (gerar PDF, migrar fotos/documentos, enviar e-mail lendo do SharePoint). `api/_lib/graph.js` fala com o Microsoft Graph (client credentials, permissão `Sites.Selected` só no site `ZURI-FINANCEIRO`). `api/_lib/armazenamento.js` orquestra: fotos e documentos sobem do celular para o Vercel Blob (contorna o limite de 4,5 MB da função), e ao gerar o PDF, `migrarParaSharePoint` copia tudo para a subpasta da proposta (nomeada pela tag, ex. `0006_Zuri_2026.10.14_NomeDoImovel`) dentro de **"ZURI - Novos Investimentos/ZURI - Propostas"**, no site `arjonholding.sharepoint.com/sites/ZURI-FINANCEIRO`, biblioteca "Documentos Compartilhados", e apaga a cópia temporária do Blob.

Variáveis em uso no Vercel: `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET` (Production e Preview).

**Dois erros reais encontrados e corrigidos no dia 14/10**, documentar para não repetir:
1. Bug de sintaxe em `api/pdf.js`: `const [fotos, ...]` da migração colidia com `const fotos` já usado para os dados do PDF, quebrava a função inteira (`FUNCTION_INVOCATION_FAILED` cru, sem chegar ao try/catch). Corrigido renomeando as variáveis da migração.
2. Confusão no e-mail do TI sobre qual campo é o segredo: o e-mail trazia "KEY" (formato `4JG8Q~dlwGYKlR...`, esse é o Secret Value de verdade) e "VALUE" (um GUID, que na realidade era o Secret ID). Os rótulos do e-mail do TI estavam trocados em relação aos nomes do portal do Entra. Além disso, um espaço ou quebra de linha colado junto ao secret causava `AADSTS7000215: Invalid client secret` mesmo com o valor certo (igual já tinha acontecido com o RESEND_API_KEY); `api/_lib/graph.js` agora aplica `.trim()` nas três variáveis por segurança.

## O que falta

- **Apagar as chaves antigas do Resend** no painel (a chave original, que tinha um caractere inválido colado nela, e a "v2" trocada em seguida), depois de confirmar que a chave mais nova funciona.
- Testar no iPhone e Android: fotos, WhatsApp, Abrir/Compartilhar PDF (herdado do app antigo, nunca confirmado lá nem aqui). Instalar como PWA: abrir o site, "Adicionar à Tela de Início" (iPhone) ou "Adicionar à tela inicial" (Android).
- Testar o fluxo completo com fotos e documentos reais (o teste de 14/10 foi só com o PDF, sem anexos), confirmando que a migração do Blob para o SharePoint funciona para eles também.
- Migrar os poucos negócios de teste do Supabase antigo, se fizer sentido manter histórico.
- Decidir quando desligar de vez o projeto Supabase/Vercel antigo.
