# Handoff: ZFlip (calculadora de flip imobiliário da Zuri Real Estate)

**Data:** 2026-09-28
**Status:** em andamento. App em produção e funcional; sessão terminou com tudo publicado e sem pendência técnica bloqueante, só decisões de negócio em aberto (seção 6).

---

## 1. Objetivo

PWA para a Zuri Real Estate calcular a economia de um negócio de flip imobiliário em dois sentidos (preço de compra informado e preço máximo de compra para bater o ROI alvo) e gerar uma folha de proposta em PDF, enviável por e-mail ou WhatsApp. Uso interno (Guto e corretores), sem login. O Supabase funciona também como banco de dados dos negócios, com fotos e documentos.

Nesta sessão (2026-09-28): aplicada a migração pendente da sessão anterior (tag automática da proposta), e implementadas duas features novas a pedido do usuário: prazo para CPCV com datas calculadas na proposta, e inversão do padrão do campo de remodelação (euros em vez de percentual).

## 2. Contexto essencial

**Stack**
- Frontend: HTML, CSS e JS puro (sem framework, sem build). PWA com `manifest.json` e `sw.js`.
- Backend: Vercel Functions em `api/` (Node 24, ESM). Dependências: `@sparticuz/chromium`, `puppeteer-core`, `@supabase/supabase-js`, `pdf-lib`, `resend`.
- Banco e arquivos: Supabase, projeto `ZFlipDB`, ref `srhrcbaeferxzwdneukx`, região eu-west-1.
- E-mail: Resend. PDF: Chromium serverless (Puppeteer) + pdf-lib para juntar anexos.

**Endereços e IDs**
- App: https://zflip-eosin.vercel.app
- Repositório: github.com/nielebock/zflip, branch `main`, com auto-deploy pela Vercel
- Projeto Vercel: `zflip` (`prj_kkG8FgHGnnPWq8jvBYxlyjBbJpQy`), equipe `team_8QM8psMHncP11bluZYMqN9KG` (Carlos Nielebock's projects), plano Hobby
- Painel Supabase: https://supabase.com/dashboard/project/srhrcbaeferxzwdneukx

**Variáveis de ambiente na Vercel** (valores nunca em texto)
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`: todos os ambientes
- `SUPABASE_SECRET_KEY` e `RESEND_API_KEY`: Production e Preview, tipo Secret
- `RESEND_FROM`: opcional, ainda não definida (padrão no código: `ZFlip Zuri Real Estate <onboarding@resend.dev>`)

**Regras do projeto (CLAUDE.md da pasta)**
- Português do Brasil em todo texto do app; nunca hífens nem travessões; nenhum emoji
- Secret key do Supabase e chave do Resend só em Vercel Functions, nunca no navegador
- RLS ativo em toda tabela nova, sem exceção
- Modo conciso; só perguntar em ambiguidade real; procurar biblioteca pronta antes de construir algo do zero
- Esforço alto só para Puppeteer/Chromium na Vercel e para o teste de escalões de IMT na conta reversa

**Decisões já tomadas (não reabrir sem motivo novo)**
- Preço de compra é **opcional**. Sem ele, só a conta reversa é calculada.
- Colunas: "Preço máximo (ROI alvo)" primeiro, "Com preço de compra informado" depois, na tela e no PDF.
- Fotos: até 20; todas no Supabase, reduzidas a 1600 px, com miniatura. Até 4 principais aparecem grandes no PDF.
- Documentos: entram como páginas no PDF se PDF, JPG, PNG, TXT, CSV ou MD; Word/Excel/HEIC/WebP ficam "Somente listado".
- Sem login. Tabela `negocios` com RLS ativo e nenhuma política: só a Secret key (dentro das funções) acessa.
- O servidor recalcula tudo com o mesmo `js/imt.js` e `js/engine.js` do navegador (`api/_lib/motor.js`).
- Percentuais são guardados como fração (0.05 = 5%). Em `remodelacao_valor_ou_pct`: fração no modo `pct`, euros no modo `fixo`.
- **Novo nesta sessão:** modo de remodelação passa a ter **valor direto em euros como padrão** (antes era `%`). O usuário pode trocar para `%` manualmente. O campo de input não tem mais valor pré-preenchido (antes tinha `12`, que fazia sentido como `12%` mas não como `12€`); fica em branco até o usuário digitar.
- **Novo nesta sessão:** tag automática da proposta (formato `0001_Zuri_AAAAMMDD_NomeDoImovel`), calculada no servidor (`api/_lib/nome.js`) logo após o insert em `negocios`, não como coluna gerada (a normalização de acentos via `unaccent` não é permitida em generated column do Postgres).
- **Novo nesta sessão:** prazo para CPCV, em dias, contado a partir da data de criação da proposta (`negocios.criado_em`). Na folha de proposta aparecem quatro datas/prazos: Data de criação, Data CPCV (criação + dias), Prazo do negócio (meses, campo já existente), Data de venda prevista (Data CPCV + prazo em meses). O campo de dias não entra em nenhum cálculo financeiro, é só para exibição na proposta.

## 3. O que já foi feito

Sessões anteriores (2026-09-16 e 2026-09-26), resumido: calculadora, motor, gráfico de margem, PDF em servidor via Chromium, deploy na Vercel, upload de fotos/documentos, e-mail via Resend, WhatsApp, correções de iPhone, numeração sequencial e tag (código pronto mas migração ainda não aplicada no banco).

Sessão de 2026-09-28, em ordem:
1. Aplicada a migração `supabase/004_tag.sql` no banco via MCP do Supabase (CLI não estava instalada na máquina local; usuário escolheu o MCP em vez de instalar a CLI). Conferida com leitura só de `numero, tag, nome`: 3 negócios existentes receberam tag retroativa corretamente.
2. Implementado prazo para CPCV:
   - Novo campo no formulário `index.html`: "Prazo para CPCV (dias)", padrão 30, posicionado antes de "Prazo do negócio (meses)".
   - `js/app.js`: lê o novo campo (`prazo_cpcv_dias`) em `readInputs()`.
   - `api/negocio.js`: valida (inteiro, `>= 0`) e grava o campo no insert de `negocios`.
   - `api/_lib/proposta.js`: nova função `blocoPrazos()` que calcula e renderiza Data de criação, Data CPCV, Prazo do negócio, Data de venda prevista, num bloco novo (`.prazos`, grade de 4 colunas) logo no início do corpo do PDF, antes da tabela financeira.
   - `supabase/005_prazo_cpcv.sql`: migração `alter table` adicionando `prazo_cpcv_dias integer not null default 30 check (>= 0)`.
   - Migração aplicada no banco via MCP do Supabase, depois de uma primeira tentativa ser bloqueada pelo classificador de permissões do Claude Code (ação marcada "Production Deploy"); usuário pediu explicitamente para tentar de novo e a segunda tentativa passou. Conferida com leitura de `numero, tag, prazo_meses, prazo_cpcv_dias`.
3. Invertido o padrão do modo de remodelação: `<select>` passou a ter `fixo` (Valor direto em €) selecionado por padrão, em vez de `pct` (%). Label inicial ajustada para "Remodelação (€)" e removido o valor pré-preenchido `12` do input (não fazia sentido como padrão em euros).
4. Todas as mudanças da sessão commitadas, enviadas ao GitHub e mescladas na `main` (usuário escolheu "commitar e enviar direto para main" entre três opções oferecidas). Isso também publicou, pela primeira vez em produção, a feature de tag automática da proposta e a numeração sequencial, que já estavam prontas em código desde 2026-09-26 mas nunca tinham sido mescladas na `main` (ficaram só na branch `claude/funny-rubin-cx1nnd`).
5. Deploy de produção confirmado como "Ready" via `vercel ls --non-interactive` (commit `c3bbcea`, ~1 minuto após o push).

**Descartado**
- Instalar a CLI do Supabase localmente: usuário preferiu usar o MCP já conectado.
- Deixar um valor padrão em euros no campo de remodelação (ex. manter `12`): descartado por não ter base real; campo fica em branco até o usuário preencher.

## 4. Estado atual

**Funciona (testado até onde dá sem gerar negócio novo)**
- Migrações 004 (tag) e 005 (prazo CPCV) aplicadas e conferidas por leitura direta no banco (Supabase MCP `execute_sql`).
- Deploy de produção "Ready" na Vercel após o merge na `main`.
- Lógica de cálculo de datas (`blocoPrazos` em `api/_lib/proposta.js`) revisada por leitura de código, mas **não testada gerando um PDF real** nesta sessão.

**Não confirmado**
- Gerar um PDF de verdade no app publicado e conferir visualmente o bloco "Prazos" (datas, formatação, quebra de layout com 4 colunas).
- Testar o formulário no navegador (campo novo de dias, comportamento do select de remodelação com o novo padrão, label trocando corretamente ao alternar `%`/`€`).
- Confirmar que negócios salvos antes desta sessão (que não tinham `prazo_cpcv_dias` antes da migração) exibem corretamente `30 dias` (valor padrão da coluna) na proposta, e não quebram o cálculo de datas.
- Tudo que já estava "não confirmado em aparelho real" no handoff anterior (compartilhar por WhatsApp, painel Abrir/Compartilhar PDF no iPhone, e-mail chegando à caixa de entrada) continua sem confirmação nesta sessão.

**Limitações conhecidas** (herdadas, sem mudança)
- Remetente de teste do Resend só entrega ao e-mail dono da conta.
- Word e Excel não entram no PDF, só listados.
- Sem tela de histórico no app; consulta é pelo painel do Supabase.

## 5. Próximos passos

1. Testar no navegador: abrir o app publicado, preencher um negócio, confirmar que o campo "Prazo para CPCV (dias)" aparece antes de "Prazo do negócio (meses)" e que o select de remodelação abre em "Valor direto (€)" com o input vazio.
2. Gerar um PDF de teste (preferir interceptar a requisição ou reaproveitar um negócio existente, para não sujar o banco — ver armadilha já conhecida na seção 8) e conferir visualmente o bloco "Prazos": as quatro datas/valores, layout em 4 colunas, formatação de data em português.
3. Conferir o caso de negócio antigo (antes da migração 005): gerar proposta para o negócio `numero=1` ("Teste 7 fotos") e confirmar que aparece `Prazo para CPCV: 30 dias` (valor padrão da coluna) sem erro.
4. Seguir os próximos passos já pendentes do handoff anterior (ver seção 6 e HANDOFF.md de 2026-09-26, agora incorporado aqui): decidir envio de e-mail (Resend com domínio da Zuri vs. Microsoft 365), testar em iPhone/Android, implementar rotina de limpeza (baixar arquivos do Supabase antes de apagar negócio).

## 6. Perguntas em aberto

1. **Envio de e-mail:** Resend com domínio verificado, ou Microsoft 365 (Outlook/Graph) como remetente? Qual será o endereço remetente? Ainda em aberto, aguardando domínio e Microsoft 365 da Zuri.
2. **Armazenamento / limpeza:** decidido em 2026-09-28 (sessão anterior) que, quando entrar o Microsoft 365, o fluxo será baixar manualmente os arquivos do Supabase antes de apagar um negócio. Falta implementar essa rotina no app; hoje é 100% manual no painel do Supabase.
3. **Valor default do campo de remodelação em euros:** o campo ficou sem valor pré-preenchido (antes tinha `12`, herdado do modo `%`). Vale perguntar ao usuário se ele quer algum valor padrão em euros, ou se prefere mesmo deixar em branco.
4. **Prazo para CPCV padrão de 30 dias:** valor escolhido sem confirmação explícita do usuário (ele só pediu o campo, não especificou o padrão). Vale confirmar se 30 é o número certo para o negócio da Zuri.

## 7. Artefatos relevantes

**Arquivos tocados nesta sessão**
```
index.html                       campo prazo_cpcv_dias; select modo_remodelacao com fixo como padrão
js/app.js                        readInputs() lê prazo_cpcv_dias
api/negocio.js                   valida e grava prazo_cpcv_dias
api/_lib/proposta.js             blocoPrazos() (Data criação/CPCV/venda) + CSS .prazos
supabase/004_tag.sql             aplicada nesta sessão (numero + tag)
supabase/005_prazo_cpcv.sql      aplicada nesta sessão (prazo_cpcv_dias)
```

**Arquivos gerais do projeto** (ver spec completa em `zflip_spec_claude_code.md`)
```
css/style.css, manifest.json, sw.js, vercel.json, package.json
js/imt.js, js/engine.js          motor de cálculo (usado também no servidor)
js/arquivos.js                   fotos (até 20, principais) e documentos
js/exportar.js                   nome do imóvel, upload, PDF, e-mail, WhatsApp
api/pdf.js                       monta o PDF (Chromium + pdf-lib) e devolve link
api/email.js                     envia o PDF anexado pelo Resend
api/_lib/                        supabase.js, motor.js, proposta.js, anexos.js, nome.js, http.js
supabase/001..003                tabela negocios, bucket, fotos principais
```

**Comandos úteis**
```
vercel ls --non-interactive                    deploys e status
vercel env ls --non-interactive                variáveis (valores Secret aparecem ocultos)
git log origin/main..HEAD --oneline            confirmar se há commits locais não publicados
```
SQL de conferência (somente leitura):
```sql
select numero, tag, nome, prazo_meses, prazo_cpcv_dias from public.negocios order by numero;
```

**MCP do Supabase disponível nesta sessão:** `mcp__plugin_supabase_supabase__*` (apply_migration, execute_sql, list_projects, etc.), usado para aplicar as migrações 004 e 005 sem precisar da CLI instalada localmente. `project_id` = `srhrcbaeferxzwdneukx`.

## 8. Instruções pra próxima sessão

- Ler `CLAUDE.md` e `zflip_spec_claude_code.md` primeiro. Português do Brasil, sem hífens nem travessões nem emojis em texto do app. Respostas concisas; perguntar só em ambiguidade real.
- Não reabrir as decisões da seção 2.
- **Antes de aplicar qualquer migração ou mudar dados em produção, confirmar explicitamente com o usuário se a ação for bloqueada pelo classificador de permissões do Claude Code** (aconteceu nesta sessão com uma migração aditiva e simples; o usuário confirmou e a segunda tentativa passou).
- **Sempre verificar se a branch atual está mesclada na `main`** antes de dizer "está pronto" ou "está em produção". Nesta sessão, duas features inteiras (tag automática e numeração sequencial) ficaram prontas em código por dias sem nunca terem sido mescladas na `main`, então nunca chegaram à produção. Rodar `git log origin/main..HEAD --oneline` é suficiente para checar.
- **Cada teste completo cria um negócio e arquivos no Supabase.** Prefira testar sem gravar (interceptar a requisição, ou reaproveitar um negócio existente) e avise o usuário do que sobrar. O classificador de permissões do Claude Code bloqueia scripts que apagam arquivos na nuvem, mesmo com autorização em conversa; a limpeza é feita pelo usuário no painel do Supabase.
- Armadilhas já pisadas (herdadas): `window.open` depois de espera assíncrona é bloqueado no iOS; `grid 1fr` sem `minmax(0, 1fr)` estoura a largura no celular; regra `.field input { width: 100% }` vence classes simples; no zsh, `for t in $var` não separa palavras (usar `${=var}`); `vercel env add` aceita um ambiente por chamada; valores Secret não podem ser lidos de volta.
- Depois de publicar, confirmar que o deploy novo está no ar (`vercel ls --non-interactive`, status "Ready" em Production) antes de dizer que está pronto.
- Nunca colocar chaves em código do navegador, em arquivos do repositório ou neste documento.
