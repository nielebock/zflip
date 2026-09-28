# Handoff: ZFlip (calculadora de flip imobiliário da Zuri Real Estate)

**Data:** 2026-09-26
**Status:** aguardando dependências externas (domínio e e-mail da Zuri, Microsoft 365). O app está em produção e funcional; nada está quebrado que se saiba.

---

## 1. Objetivo

PWA para a Zuri Real Estate calcular a economia de um negócio de flip imobiliário em dois sentidos (preço de compra informado e preço máximo de compra para bater o ROI alvo) e gerar uma folha de proposta em PDF, enviável por e-mail ou WhatsApp. Uso interno (Guto e corretores), sem login. O Supabase funciona também como banco de dados dos negócios, com fotos e documentos.

Na sessão de 2026-09-26 foi implementado tudo o que a spec pedia e ainda não existia: Supabase, uploads, PDF no servidor, e-mail (Resend) e WhatsApp. Depois, ajustes a partir de testes no iPhone.

## 2. Contexto essencial

**Stack**
- Frontend: HTML, CSS e JS puro (sem framework, sem build). PWA com `manifest.json` e `sw.js` (network first, cache `zflip-v4`, ignora `/api`).
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
- `SUPABASE_SECRET_KEY` e `RESEND_API_KEY`: Production e Preview, tipo Secret (a Vercel não aceita Secret em Development e não permite baixar o valor com `vercel env pull`)
- `RESEND_FROM`: opcional, ainda não definida (padrão no código: `ZFlip Zuri Real Estate <onboarding@resend.dev>`)

**Regras do projeto (CLAUDE.md da pasta)**
- Português do Brasil em todo texto do app; nunca hífens nem travessões; nenhum emoji
- Secret key do Supabase e chave do Resend só em Vercel Functions, nunca no navegador
- RLS ativo em toda tabela nova, sem exceção
- Modo conciso; só perguntar em ambiguidade real; procurar biblioteca pronta antes de construir algo do zero
- Esforço alto só para Puppeteer/Chromium na Vercel e para o teste de escalões de IMT na conta reversa

**Decisões já tomadas (não reabrir sem motivo novo)**
- Preço de compra é **opcional** (decisão final do usuário; a spec foi atualizada). Sem ele, só a conta reversa é calculada e a coluna "Com preço de compra informado" mostra "Não informado".
- Colunas: "Preço máximo (ROI alvo)" primeiro, "Com preço de compra informado" depois, na tela e no PDF.
- Fotos: até 20; todas vão para o Supabase, reduzidas a 1600 px, cada uma com miniatura. O usuário escolhe até 4 **principais** (toque na foto, numeradas na ordem). A página 1 do PDF mostra miniaturas de todas; só as principais aparecem grandes, 2 por página.
- Documentos: entram no PDF como páginas se forem PDF, JPG, PNG, TXT, CSV ou MD. Word, Excel, HEIC e WebP ficam "Somente listado" (não há conversão confiável na Vercel). Se um PDF ou imagem não abrir, a lista mostra "Não foi possível incluir".
- Anexos (fotos e documentos) ficam **depois do cálculo**, opcionais. Nada vai ao servidor até o usuário gerar o PDF ou enviar.
- Ao gerar ou enviar, abre uma janela pedindo o **nome do imóvel ou projeto** (obrigatório). O nome vira título do PDF, assunto do e-mail e nome do arquivo (`proposta-<nome>.pdf`).
- Sem login. Tabela `negocios` com RLS ativo e **nenhuma política**: a chave pública não lê nada; todo acesso passa pela Secret key dentro das funções.
- O servidor recalcula tudo com o mesmo `js/imt.js` e `js/engine.js` do navegador (`api/_lib/motor.js`), sem segunda cópia das fórmulas.
- Percentuais são guardados como fração (0.05 = 5%). Em `remodelacao_valor_ou_pct`: fração no modo `pct`, euros no modo `fixo`.
- Uploads vão do celular direto ao Storage por URL assinada (fetch PUT), porque a Vercel limita o corpo a 4,5 MB.

## 3. O que já foi feito

Sessão anterior (2026-09-16), resumido: calculadora, motor, gráfico de margem, PDF em jsPDF, deploy na Vercel, campos verdes, preço de compra opcional, service worker network first.

Sessão de 2026-09-26, em ordem:
1. Variáveis de ambiente gravadas pelo Vercel CLI (a conexão MCP da Vercel deu 403). CLI instalado globalmente e logado; pasta ligada ao projeto.
2. Supabase: migrações 001 (tabela `negocios`, bucket privado `documentos-negocios`), 002 (`nome`), 003 (fotos até 20, `miniaturas`, `fotos_principais`). Aplicadas no projeto e versionadas em `supabase/`.
3. Funções `api/negocio.js`, `api/pdf.js`, `api/email.js`; template `api/_lib/proposta.js` com a paleta ZURI; `api/_lib/anexos.js` para juntar documentos.
4. Testes: local, deploy de preview e produção; Chromium serverless gera o PDF em cerca de 8 s a frio.
5. Correções vindas dos testes no iPhone do usuário:
   - Erro `window.supabase.createClient` (a biblioteca do CDN não carregava no iPhone): removida; upload por fetch simples. `api/config.js` foi removido.
   - Campos saindo da tela: grade `minmax(0, 1fr)`, campos de 16 px (evita zoom do iOS), campos de arquivo escondidos com regra específica (uma regra de largura 100% os esticava).
   - "no files selected": botões próprios em português com contador.
   - PDF não abria: `window.open` depois de esperar o servidor é bloqueado no iOS. Agora aparece um painel com Abrir PDF (link) e Compartilhar PDF.
   - Documentos `.txt` não entravam: passaram a entrar como páginas de texto; a tela avisa por arquivo "entra no PDF" ou "só listado".
   - Rodapé caindo sozinho numa página em branco: lista de documentos e rodapé agrupados (`.fecho`).
6. Campo de e-mail vem preenchido com `nielebock@gmail.com`.
7. Fotos: até 20, com principais e miniaturas (decisão final acima).

**Descartado**
- jsPDF no navegador: substituído por PDF no servidor (spec).
- supabase-js via CDN no navegador: não carregou no iPhone.
- Abrir o PDF com `window.open` automático: bloqueado no iOS.
- Guardar só as 4 fotos principais: o usuário quer todas no banco.

## 4. Estado atual

**Funciona (testado)**
- Cálculo das duas contas, IMT, casos limite (sem preço de compra, IMT desligado, prazo 0, remodelação fixa).
- Fluxo completo em Chrome com tela de 390 px: anexos, nome, upload, PDF, e-mail para o endereço de teste do Resend, painel de abrir e compartilhar.
- PDF de 1 página com até 20 miniaturas e 5 documentos; páginas de fotos grandes; documentos PDF, PNG e TXT embutidos. Os PDFs reais do usuário (Cartão Empresa e Certidão Permanente) embutem corretamente.
- RLS: a chave pública lê zero linhas.

**Não confirmado em aparelho real**
- Painel Abrir PDF e Compartilhar PDF no iPhone depois das correções (o usuário não chegou a confirmar).
- Compartilhamento por WhatsApp com arquivo (Web Share); o fallback wa.me foi testado só isoladamente.
- Escolha das fotos principais e envio de muitas fotos no iPhone.
- E-mail chegando de fato à caixa de entrada (foi testado com `delivered@resend.dev`; para `nielebock@gmail.com` não há confirmação registrada).

**Limitações conhecidas**
- Remetente de teste do Resend: só entrega ao e-mail dono da conta Resend.
- Word e Excel não entram no PDF (só listados).
- O app não tem tela de histórico; para ver negócios, fotos e documentos usar o painel do Supabase (Table Editor, tabela `negocios`; Storage, bucket `documentos-negocios`, uma pasta por id com `fotos/`, `miniaturas/`, `documentos/` e o PDF).

**Dados de teste**: sobrou 1 negócio ("Teste 7 fotos", id `9e7e9d0c-c5ed-4da0-a088-4a2c742699b9`) com os arquivos dele. O usuário já apagou os demais.

**Git**: último commit `203df2c` (em `main`, publicado). `CLAUDE.md` e `zflip_spec_claude_code.md` continuam sem commit (são do usuário). Este `HANDOFF.md` foi reescrito e não foi commitado.

## 5. Próximos passos

**Pendente, aplicar no painel do Supabase (SQL Editor):** rodar `supabase/004_tag.sql`. Adiciona `numero` (sequencial automático) e `tag` (coluna gerada, formato `0001_Zuri_AAAAMMDD_NomeDoImovel`) na tabela `negocios`. A tag é calculada automaticamente a cada negócio salvo (na gravação, que hoje acontece em Gerar PDF, Enviar e-mail e WhatsApp, decisão mantida) e passa a ser usada como nome do arquivo do PDF (Storage, download, anexo do e-mail). Negócios já salvos antes da migração recebem `numero`/`tag` retroativos na própria migração; o código tem fallback para o nome antigo (`proposta-<nome>`) caso `tag` venha vazia por algum motivo.

Quando o usuário voltar com o domínio, o e-mail da Zuri e o Microsoft 365:
1. Definir com o usuário **como o e-mail sai** (ver pergunta 1 abaixo) antes de escrever código.
2. Se for Resend com domínio da Zuri: verificar o domínio no painel do Resend (registros DNS), criar `RESEND_FROM` na Vercel (ex.: `Zuri Real Estate <propostas@dominio>`, Production e Preview), republicar, testar um envio para um endereço que não seja o dono da conta.
3. Remover o valor padrão `nielebock@gmail.com` de `#email_destino` em `index.html` (ou trocar por um endereço da Zuri).
4. Se for Microsoft 365: avaliar Microsoft Graph (registro de aplicativo no Entra ID, permissão `Mail.Send`) em vez do Resend; segredos só em variáveis da Vercel.
5. Testar no iPhone e no Android: gerar PDF, Abrir PDF, Compartilhar PDF no WhatsApp, escolha de fotos principais, e-mail.
6. Implementar a rotina de limpeza decidida em 2026-09-28 (pergunta 4): antes de apagar um negócio, baixar manualmente do Supabase (fotos, documentos, PDF) para uma pasta local ou na nuvem. Ainda sem apoio no app; hoje é tudo manual no painel do Supabase.

Melhorias possíveis, sem urgência: tela de histórico de negócios no app; logo real da Zuri no PDF; fotos originais em vez das reduzidas (custa muito mais armazenamento); 2FA na conta Vercel.

## 6. Perguntas em aberto

1. **Envio de e-mail:** Resend com domínio verificado, ou Microsoft 365 (Outlook/Graph) como remetente? Qual será o endereço remetente? **Ainda em aberto** (resposta do usuário em 2026-09-28: ainda não tem a definição).
2. ~~**Condomínio na fórmula reversa**~~ **Resolvido em 2026-09-28: não replicar.** O app segue sem descontar condomínio na conta reversa, como já estava.
3. ~~**Chaves coladas na conversa**~~ **Resolvido em 2026-09-28: não rotacionar.** O usuário avalia o risco como baixo porque a conversa é privada.
4. **Armazenamento / limpeza:** decidido em 2026-09-28 que, quando entrar o Microsoft 365, o fluxo será baixar manualmente os arquivos (fotos, documentos, PDF da proposta) do Supabase para uma pasta local ou na nuvem, e só então limpar o negócio do banco. Falta implementar essa rotina (hoje a limpeza só é feita manualmente no painel do Supabase, sem nenhum apoio no app). Ver item na seção 5.
5. ~~**Regra de permissão do script de limpeza**~~ **Esclarecido em 2026-09-28:** é uma regra em `/permissions` do Claude Code (não do Supabase), que autorizava rodar `limpar.sh`. O script já foi apagado do disco; falta só confirmar em `/permissions` que a regra também foi removida, senão ela fica autorizando um comando que não existe mais.

## 7. Artefatos relevantes

**Arquivos**
```
index.html, css/style.css, manifest.json, sw.js, vercel.json, package.json
js/imt.js, js/engine.js          motor de cálculo (usado também no servidor)
js/app.js                        formulário, tabela, gráfico de margem, botões
js/arquivos.js                   fotos (até 20, principais) e documentos
js/exportar.js                   nome do imóvel, upload, PDF, e-mail, WhatsApp
api/negocio.js                   valida, calcula, salva, devolve URLs de upload
api/pdf.js                       monta o PDF (Chromium + pdf-lib) e devolve link
api/email.js                     envia o PDF anexado pelo Resend
api/_lib/                        supabase.js, motor.js, proposta.js, anexos.js, nome.js, http.js
supabase/001_negocios.sql, 002_nome.sql, 003_fotos_principais.sql
zflip_spec_claude_code.md        spec (preço de compra opcional e fotos até 20 já atualizados)
```

**Comandos úteis**
```
vercel deploy --prod --yes                     publicar manualmente (o auto-deploy falhou uma vez)
vercel ls --non-interactive                    deploys e status
vercel env ls --non-interactive                variáveis (valores Secret aparecem ocultos)
vercel env add NOME production --value "..." --sensitive --yes --non-interactive   uma chamada por ambiente
```
SQL de conferência (somente leitura): `select nome, cardinality(fotos), cardinality(fotos_principais), pdf_path from public.negocios order by criado_em;`

**Como testar localmente as funções**: importar `api/negocio.js`, `api/pdf.js`, `api/email.js` e chamar `POST(new Request(...))` com as variáveis passadas na linha de comando (não gravar chaves em arquivo). `api/pdf.js` usa o Google Chrome local quando não está na Vercel (`CHROME_PATH` ou o caminho padrão do macOS). Para testar a interface, servir a pasta com um servidor estático que roteie `/api/*` para essas funções e dirigir o Chrome com `puppeteer-core` em tela de 390 px.

## 8. Instruções pra próxima sessão

- Ler `CLAUDE.md` e `zflip_spec_claude_code.md` primeiro. Português do Brasil, sem hífens nem travessões nem emojis em texto do app. Respostas concisas; perguntar só em ambiguidade real.
- Não reabrir as decisões da seção 2.
- **Cada teste completo cria um negócio e arquivos no Supabase.** Prefira testar sem gravar (interceptar a requisição, ou reaproveitar um negócio existente) e avise o usuário do que sobrar. O classificador de permissões do Claude Code bloqueia scripts que apagam arquivos na nuvem, mesmo com autorização em conversa; a limpeza é feita pelo usuário no painel do Supabase (`delete from public.negocios;` e esvaziar o bucket) ou por regra de permissão criada por ele em `/permissions`.
- Armadilhas já pisadas: `window.open` depois de espera assíncrona é bloqueado no iOS (usar link tocado); `grid 1fr` sem `minmax(0, 1fr)` estoura a largura no celular; regra `.field input { width: 100% }` vence classes simples; no zsh, `for t in $var` não separa palavras (usar `${=var}`); `vercel env add` aceita um ambiente por chamada; valores Secret não podem ser lidos de volta.
- Depois de publicar, confirmar que o deploy novo está no ar (o push já falhou uma vez em disparar o deploy automático) antes de dizer que está pronto.
- Nunca colocar chaves em código do navegador, em arquivos do repositório ou neste documento.
