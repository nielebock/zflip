# Handoff: ZFlip 2.0 (migração Supabase → Neon + Vercel Blob)

**Data:** 2026-10-13
**Status:** em andamento, mas publicado e funcional. App novo (`zflip2.0`) em produção, em paralelo ao app antigo (que continua intacto). Faltam pendências pequenas e a integração com SharePoint (bloqueada no TI).

---

## 1. Objetivo

Reconstruir o backend do ZFlip (calculadora de flip imobiliário da Zuri Real Estate, ver `CLAUDE.md` e `zflip_spec_claude_code.md` para o app em si) trocando o Supabase (Postgres + Storage) por **Neon** (Postgres) e **Vercel Blob** (armazenamento), por decisão do usuário, sem mexer no app em produção enquanto isso. O app funcional (cálculo, PDF, e-mail, WhatsApp) continua exatamente igual; só o que está por trás mudou. No fim, a ideia é trocar o Vercel Blob pelo SharePoint da Zuri, assim que o TI liberar.

## 2. Contexto essencial

**Stack nova (branch `zflip2-neon`)**
- Frontend: igual ao app antigo, HTML/CSS/JS puro, sem build.
- Backend: Vercel Functions em `api/`. Mesmas dependências do app antigo, trocando `@supabase/supabase-js` por `@neondatabase/serverless` e `@vercel/blob`.
- Banco: Neon, projeto `zflip2.0`, região Londres (AWS eu-west-2).
- Armazenamento: Vercel Blob, Store `zflip2.0-blob`, acesso **Público** (obrigatório: o link do PDF é compartilhado por WhatsApp/e-mail, sem token).
- E-mail: Resend, domínio `zurirealestate.pt` verificado (DKIM, SPF, DMARC), sem MX (só envio).
- Domínio do app: `zflip.zurirealestate.com` (DNS gerenciado na OVH).

**Decisões tomadas nesta sessão**
- **Estrutura em paralelo, não substituição**: branch `zflip2-neon`, projeto Vercel `zflip2.0` separado do `zflip` original. O app antigo (`zflip-eosin.vercel.app`, Supabase) não foi tocado.
- **Vercel Blob como ponte temporária**, não solução final. `api/_lib/armazenamento.js` é a única peça que vai mudar quando o SharePoint for liberado; o resto do código (`negocio.js`, `pdf.js`, `email.js`) só conhece as 3 funções desse arquivo (`subirArquivo`, `baixarComoBuffer`, `caminhoParaUpload`), não o Blob diretamente.
- **`zurirealestate.com` não pôde ser usado para e-mail**: o TI já configurou alias de e-mail do `zurire.com` nesse domínio, risco de quebrar isso. Por isso o Resend foi verificado no `zurirealestate.pt` (domínio separado, limpo, também na OVH).
- **Numeração da proposta**: 5 propostas já existem no sistema antigo (Supabase), então a sequência no Neon foi reiniciada para começar em 6 (`negocios_numero_seq restart with 6`), para não colidir a numeração entre os dois sistemas.
- **Remetente do e-mail**: `Zuri Propostas <propostas@zurirealestate.pt>`. Toda proposta enviada vai com `cc` e `replyTo` para `financeiro@zurire.com` (a caixa `propostas@` só encaminha, não tem inbox própria).
- **Assunto do e-mail**: passou a incluir a tag da proposta (`Proposta 0006_Zuri_2026.10.13_NomeDoImovel: NomeDoImovel`), não só o nome.
- **Campo de e-mail do destinatário**: removido o valor padrão (`nielebock@gmail.com`), que só existia porque o Resend em modo teste só entregava para o dono da conta. Com o domínio verificado, envia para qualquer destinatário.

## 3. O que já foi feito, em ordem

1. Código inteiro portado de Supabase para Neon + Vercel Blob (`api/_lib/db.js` novo, `api/_lib/supabase.js` removido, `api/negocio.js`/`pdf.js`/`email.js` reescritos com SQL direto via template marcado do driver do Neon).
2. `api/blob-upload.js` criado (emite token de upload do Vercel Blob para o celular, substituindo a signed URL do Supabase Storage).
3. **Auditoria de segurança** rodada na branch: achado real (confiança 7/10, abaixo do corte de reportar) sobre `onBeforeGenerateToken` aceitar qualquer caminho sem checar dono. Corrigido mesmo assim, como reforço: agora confere que o caminho pedido pertence a um negócio existente no banco antes de emitir o token.
4. Usuário criou o projeto no Neon, rodou o schema (`neon/001_schema.sql`), criou o projeto novo na Vercel apontando para a branch `zflip2-neon`, criou o Blob Store.
5. **Armadilha**: o Blob Store precisa ser criado com Access **Public** (não o padrão "Private") e com a caixa "Add a read-write token env var to this connection" marcada, senão a `BLOB_READ_WRITE_TOKEN` não é criada e o PDF falha silenciosamente.
6. Domínio `zflip.zurirealestate.com` cadastrado na Vercel, CNAME criado na OVH (`zflip` → `cname.vercel-dns.com`), certificado SSL emitido, confirmado via `curl` e pela API da Vercel (`misconfigured: false`).
7. Resend configurado: domínio `zurirealestate.pt` verificado, chave de API criada.
8. **Dois bugs achados e corrigidos testando de ponta a ponta** (criei negócio de teste e chamei a API em produção direto via `curl`, não só confiando no "parece certo"):
   - `BLOB_READ_WRITE_TOKEN` ausente (resolvido reconectando o Blob Store com as opções certas, passo 5 acima).
   - Erro `Cannot convert argument to a ByteString... value of 8220` no envio de e-mail: testei cada campo do corpo do e-mail caractere a caractere, nenhum continha o caractere problemático. Conclusão: a própria `RESEND_API_KEY` tinha um caractere invisível colado nela na hora de criar (provavelmente colada de um lugar com autocorreção de aspas). Resolvido criando uma chave nova no Resend e copiando com o botão de copiar, não selecionando manualmente.
9. **Limite de segurança do ambiente, duas vezes**: o classificador de automação deste ambiente bloqueou (a) checar a própria `RESEND_API_KEY` por um endpoint de diagnóstico público (mesmo sem expor o valor) e (b) publicar um endpoint temporário de "apagar negócio" sem autenticação. As duas vezes, recuei e segui pelo caminho manual (pedir para o usuário rodar SQL direto no Neon). Não tentar essas duas coisas de novo.
10. Testado de ponta a ponta com sucesso: criar negócio → gerar PDF → enviar e-mail, tudo confirmado funcionando no domínio de produção.

**Descartado**
- Criar um endpoint administrativo na API para apagar o negócio de teste sozinho: bloqueado pelo ambiente (ver item 9), voltei para pedir ao usuário rodar o SQL manualmente no Neon.
- Diagnosticar a `RESEND_API_KEY` via resposta de erro da própria API pública: mesmo bloqueio, resolvido recriando a chave em vez de investigar a antiga.

## 4. Estado atual

**Funciona, confirmado em produção (`https://zflip.zurirealestate.com`)**
- Criar negócio (cálculo, tag, numeração sequencial).
- Gerar PDF (sobe para o Vercel Blob, link público retornado).
- Enviar e-mail (remetente `Zuri Propostas`, cc para financeiro, assunto com a tag, PDF anexado).
- Domínio com HTTPS válido.

**Não confirmado**
- Upload de fotos/documentos do celular de verdade (o token do blob-upload foi só revisado por código e na auditoria, nunca testado com um upload real).
- PWA instalado no celular com ícone (instruções já passadas ao usuário, ele ainda não confirmou que fez).
- WhatsApp, Abrir/Compartilhar PDF no iPhone (herdado do app antigo, nunca confirmado nem lá nem aqui).

**Pendente de limpeza**
- Dois negócios de teste ficaram no banco em algum momento da sessão (ids `0e3c89ee-888d-45bd-acf9-d3e8cda4b4b0` e `dbd32878-d3ae-44cf-a54d-d75bca2151ad`); o usuário está apagando via SQL Editor do Neon, reiniciando a sequência em 6 a cada vez. **Confirmar se o último `delete` + `restart sequence` já foi rodado antes de considerar a numeração limpa.**
- Chaves antigas do Resend (a original com o caractere inválido, e a "v2" que também ficou visível numa captura de tela da conversa) ainda não foram apagadas no painel do Resend.

## 5. Próximos passos

1. **Confirmar que o SQL de limpeza mais recente foi rodado** (apagar `dbd32878-...`, reiniciar sequência em 6). Se não, rodar:
   ```sql
   delete from public.negocios where id = 'dbd32878-d3ae-44cf-a54d-d75bca2151ad';
   alter sequence public.negocios_numero_seq restart with 6;
   ```
2. Apagar as chaves antigas do Resend (API Keys, apagar a original e a "v2", manter só a mais recente).
3. Testar no celular de verdade: instalar como PWA (instruções na seção 7), subir fotos/documentos, abrir e compartilhar o PDF, mandar por WhatsApp.
4. Levar o pedido de registro no Entra ID para o TI (texto pronto na seção 7). Quando devolverem Client ID, Tenant ID e Client Secret, trocar `api/_lib/armazenamento.js` para usar o Microsoft Graph em vez do Vercel Blob. A pasta raiz `Zuri - Propostas` já existe no SharePoint; cada proposta deve virar uma subpasta dentro dela, nomeada pela tag.
5. Decidir quando desligar de vez o projeto antigo (Supabase + `zflip-eosin.vercel.app`) e se migra os negócios de teste que sobraram lá.
6. Decidir o domínio final de e-mail de produção da Zuri como um todo (ainda sem decisão sobre Microsoft 365 vs. Resend para o resto da empresa, fora do escopo do ZFlip).

## 6. Perguntas em aberto

1. Quando o TI aprovar o Entra ID, quem vai rodar a Parte 2 (autorizar o app via Graph Explorer na pasta `Zuri - Propostas`)? Precisa de alguém com acesso de admin ao site do SharePoint.
2. O negócio de teste `0006` (se ainda não foi apagado) deveria virar o primeiro negócio real, ou precisa mesmo ser removido? Usuário pediu para apagar, mas confirmar que não há nenhum uso real dele.
3. Vale a pena migrar os negócios de teste do Supabase antigo (poucos, ver handoff anterior) para o Neon, ou começar do zero é melhor?

## 7. Artefatos relevantes

**Branch e projetos**
- Repositório: `nielebock/zflip`, branch `zflip2-neon` (não confundir com `main`, que é o app antigo)
- Vercel: projeto `zflip2.0` (`prj_fI5uwORuqDOCfplKuWccdG7zij5m`), equipe `team_8QM8psMHncP11bluZYMqN9KG`
- Domínio: `https://zflip.zurirealestate.com`
- Neon: projeto `zflip2.0`, região Londres

**Arquivos principais**
```
api/_lib/db.js              cliente Postgres do Neon (DATABASE_URL)
api/_lib/armazenamento.js   camada de storage, hoje Vercel Blob (trocar por Graph quando o SharePoint liberar)
api/blob-upload.js          emite token de upload do Blob pro celular, valida dono do negócio
api/negocio.js              cria negócio, calcula, grava no Neon
api/pdf.js                  gera PDF (Chromium), sobe pro Blob
api/email.js                envia por Resend, remetente Zuri Propostas, cc pro financeiro
neon/001_schema.sql          schema consolidado das migrações do Supabase
neon/LEIA-ME.md              documentação viva desta migração, atualizar a cada mudança relevante
```

**Pedido pronto para o TI (Entra ID), ver `neon/LEIA-ME.md` para o texto completo com os passos numerados.**

**Comandos úteis**
```
# Testar a API em produção direto (sem precisar abrir o app no navegador):
curl -X POST https://zflip.zurirealestate.com/api/negocio -H "Content-Type: application/json" -d '{...}'
curl -X POST https://zflip.zurirealestate.com/api/pdf -H "Content-Type: application/json" -d '{"id":"..."}'
curl -X POST https://zflip.zurirealestate.com/api/email -H "Content-Type: application/json" -d '{"id":"...","para":"..."}'
```
SQL de conferência (Neon, somente leitura): `select numero, tag, nome from public.negocios order by numero;`

## 8. Instruções pra próxima sessão

- Ler `CLAUDE.md`, `zflip_spec_claude_code.md` e `neon/LEIA-ME.md` primeiro (nessa ordem). O `LEIA-ME.md` é a fonte de verdade do estado da migração, mais atualizado que este handoff em caso de divergência.
- Esta sessão rodou num ambiente de nuvem sem acesso direto ao banco (Neon) nem a ferramentas de navegador. Toda alteração no banco precisou ser pedida ao usuário via SQL Editor do Neon; todo teste de ponta a ponta foi feito via `curl` direto na API em produção, não pelo navegador. Se a próxima sessão tiver acesso a essas ferramentas, pode simplificar bastante.
- **Nunca tentar criar um endpoint público sem autenticação para ações administrativas** (apagar dados, etc.), mesmo que temporário: o classificador de segurança do ambiente bloqueia, e com razão. Pedir para o usuário rodar o SQL manualmente é mais lento, mas é o caminho certo.
- **Nunca tentar diagnosticar o conteúdo de uma secret (API key, token) expondo características dela** (tamanho, caracteres) numa resposta de API pública, mesmo sem revelar o valor. Se uma secret está suspeita de estar corrompida, a resposta certa é recriá-la, não investigá-la.
- Modo de trabalho do usuário: conciso, direto, gosta de testar em produção de verdade (não ficar só no "deveria funcionar"), e pede confirmação ativa a cada passo arriscado antes de prosseguir.
- Nunca usar hífens nem travessões em texto visível ao usuário, nem emojis (regra do `CLAUDE.md` do projeto, vale também para este handoff e qualquer documentação).
