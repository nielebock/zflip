# Handoff: ZFlip — Calculadora de Flip Imobiliário

**Data:** 2026-09-26 (atualizado; versão original de 2026-09-16)
**Status:** em produção, funcional — pendente uma decisão de fórmula e possíveis melhorias de UI/UX

---

## 1. Objetivo

App web (PWA, HTML/CSS/JS puro, sem framework) para a Zuri Real Estate. Recebe os dados de um negócio de flip imobiliário, calcula rentabilidade em dois sentidos (preço de compra informado vs. preço máximo de compra para bater um ROI alvo), e gera uma folha de proposta exportável em PDF por e-mail/WhatsApp.

Especificação original: documento `zflip_spec_claude_code.md` fornecido pelo usuário, baseado na aba `02_ECONOMIA_NEGOCIO` do arquivo `Arjon_BP_COSMIKVARIETY_v16/v17.xlsx` (premissas em `01_PREMISSAS`, tabela de IMT em `07_IMT_2026`).

## 2. Stack e infraestrutura

- **Código:** HTML + CSS + JS vanilla, sem build step
- **PDF:** gerado no servidor (api/pdf.js, Puppeteer + @sparticuz/chromium). O jsPDF foi removido
- **PWA:** manifest.json + service worker (`sw.js`, estratégia network-first)
- **Repositório:** `github.com/nielebock/zflip`, branch `main` (repositório próprio, separado do `imobiliario-system`)
- **Deploy:** Vercel, plano Hobby (gratuito), conta "Carlos Nielebock's projects" (`team_8QM8psMHncP11bluZYMqN9KG`)
- **URL ao vivo:** `https://zflip-eosin.vercel.app`
- **Auto-deploy:** ativo — todo push em `main` atualiza o site sozinho

### Como foi feito o deploy (para referência)
A ferramenta MCP de deploy direto (`deploy_to_vercel`) falhou com 403 (integração sem permissão de criar projeto). Solução: importar o repo GitHub direto pela UI da Vercel ("Add New → Project → Import Git Repository → nielebock/zflip"), root directory `./`, sem framework preset (site estático puro).

## 3. Estrutura do projeto

```
zflip/
├── index.html
├── css/style.css
├── js/
│   ├── imt.js      # tabela de IMT 2026 + cálculo do IMT
│   ├── engine.js    # motor: Conta 1 (direta) e Conta 2 (reversa)
│   ├── app.js       # form, render da tabela, gráfico de margem
│   └── pdf.js        # geração de PDF (jsPDF)
├── manifest.json
├── sw.js
└── icons/icon.svg
```

## 4. Motor de cálculo — decisões e estado

### Conta 1 (Direta) e Conta 2 (Reversa)
Implementadas conforme a spec original. Validadas numericamente:
- ROI calculado da Conta 2 bate exatamente no ROI alvo informado (ex.: 15,00000%)
- `aplicar_imt = false` zera IMT corretamente em ambas as contas
- `prazo_meses = 0` não quebra nada (só multiplica, nunca divide)

### ⚠️ Divergência conhecida vs. a planilha Excel (não resolvida)
Comparando com `Arjon_BP_COSMIKVARIETY_v17.xlsx`, aba `02_ECONOMIA_NEGOCIO`, encontrei que a fórmula reversa da planilha (`H34:H40`) desconta **Condomínio × Prazo** (`G34 = B15*B9`, ex. 30€/mês × 4 meses = 120€) do valor-alvo antes de calcular o preço máximo de compra. O ZFlip **não tem esse desconto**, porque a spec original dizia explicitamente:

> "Campos fora do escopo (não incluir): prazo usado no ritmo de compras, **condomínio**, todo o bloco de ritmo de compras e capital em risco."

**Resultado da divergência** (inputs default, preço venda €300.000):
| | Planilha | ZFlip (atual) |
|---|---|---|
| Preço máximo de compra | €208.438,63 | €208.537,07 |
| Diferença | — | ~€98,44 |

Todo o resto (Conta 1/direta, tabela de IMT, todas as outras fórmulas) bate exatamente com a planilha.

**Decisão pendente do usuário:** incluir o desconto de Condomínio (fixo em €30/mês, sem virar campo editável, replicando a planilha) para bater 100%? Ou manter como está, sem condomínio, conforme a spec pedia?

Se decidir incluir, a mudança é em `js/engine.js`, função `calcularPrecoMaximoCompra` — subtrair `CONDOMINIO_MENSAL * inputs.prazo_meses` do `alvo` antes de testar os escalões de IMT.

## 5. Mudanças de UI feitas nesta sessão

1. **Campos editáveis com fundo verde pastel, texto preto** (`css/style.css`, `.field input`) — só inputs numéricos, não afeta o select nem o toggle de IMT.
2. **Preço de compra passou a ser opcional** (removido `required`). Quando vazio:
   - Coluna "Preço informado" mostra "—" em vez de calcular com preço 0
   - Gráfico de margem mostra só o preço máximo calculado
   - PDF reflete o mesmo comportamento
3. **Ordem das colunas invertida**: "Preço máximo (ROI alvo)" agora vem antes de "Com preço de compra informado", na tabela e no PDF.
4. **Service worker corrigido**: estava cache-first (servia versão antiga do PWA mesmo com deploy novo). Trocado para network-first — sempre busca a versão mais recente quando há internet, só usa cache salvo quando offline. Isso resolveu o problema de "deploy novo não aparece no celular".

## 6. Pendências / possíveis próximos passos

- [ ] Decidir sobre o desconto de Condomínio na fórmula reversa (seção 4)
- [ ] Melhorias de UI/UX gerais (motivo desta nova sessão)
- [ ] Testar exportação por e-mail/WhatsApp em diferentes dispositivos (Web Share API tem suporte variável)
- [ ] Considerar adicionar campo de logo/identidade visual da Zuri no PDF (spec menciona "com logo/identidade se houver" — ainda não implementado, PDF é só texto formatado)
- [ ] 2FA na conta Vercel (recomendado ao usuário, não confirmado se foi ativado)

## 7. Referências

- Spec original: `zflip_spec_claude_code.md` (anexado pelo usuário na sessão anterior)
- Planilha de validação: `Arjon_BP_COSMIKVARIETY_v17.xlsx`, abas `01_PREMISSAS`, `02_ECONOMIA_NEGOCIO`, `07_IMT_2026`
- Este repositório é independente do `imobiliario-system` (motor de avaliação de projetos imobiliários) — projetos sem relação, mesma conta GitHub/Vercel do usuário.

## 8. Sessão 2026-09-26: backend implementado (Supabase, uploads, PDF no servidor, e-mail, WhatsApp)

Implementado o que a spec pedia e ainda não existia.

**Estrutura nova**
```
api/
  config.js      GET: devolve SUPABASE_URL e Publishable key ao navegador
  negocio.js     POST: valida, calcula no servidor, salva em `negocios`, devolve URLs assinadas de upload
  pdf.js         POST: monta o HTML ZURI, Chromium converte em PDF, salva no Storage, devolve link assinado (7 dias)
  email.js       POST: baixa o PDF do Storage e envia pelo Resend com anexo
  _lib/          supabase.js (cliente com Secret key), motor.js, proposta.js (template), http.js
js/arquivos.js   seleção de fotos (até 4, reduzidas a 1600 px no celular) e documentos
js/exportar.js   fluxo: salvar negócio, enviar arquivos direto ao Storage, gerar PDF, e-mail, WhatsApp
supabase/001_negocios.sql   tabela e bucket (já aplicado no projeto ZFlipDB)
vercel.json      memória 2048 MB e 60 s para api/pdf.js
```

**Decisões técnicas**
- Uploads vão do celular direto ao Storage por URL assinada, porque a Vercel limita o corpo da requisição a 4,5 MB e fotos de celular passam disso. A Secret key nunca sai do servidor.
- O servidor recalcula tudo com o mesmo `js/imt.js` e `js/engine.js` do navegador (api/_lib/motor.js), então não existe segunda cópia das fórmulas.
- Percentuais são guardados como fração (0.05 = 5%). Em `remodelacao_valor_ou_pct`: fração no modo pct, euros no modo fixo.
- Tabela `negocios` com RLS ativo e nenhuma política. Bucket `documentos-negocios` privado. Confirmado: a chave pública lê zero linhas.
- Variáveis na Vercel: SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY (todos os ambientes), SUPABASE_SECRET_KEY e RESEND_API_KEY (Production e Preview, tipo Secret).
- Service worker passou a ignorar `/api/` e o cache subiu para v3.

**Verificado**
- Fluxo completo local e em deploy de preview: negócio, upload, PDF, e-mail (para delivered@resend.dev), validações e RLS.
- Chromium serverless gera o PDF em cerca de 8 s a frio. Casos limite: sem preço de compra, IMT desligado, prazo 0, remodelação fixa.
- Interface no Chrome, sem erros de página.

**Ainda não verificado**
- Compartilhamento por WhatsApp em aparelho real (Web Share com arquivo). Sem suporte, abre wa.me com o link assinado do PDF.
- E-mail para destinatários reais: o remetente onboarding@resend.dev só entrega ao dono da conta Resend até o domínio da Zuri ser verificado. Depois, definir RESEND_FROM na Vercel.

**Pendências**
- [ ] Apagar os dados de teste do banco (linhas em `negocios` e arquivos no bucket). A limpeza por script foi bloqueada pelo classificador de permissões do Claude Code; fazer no painel do Supabase ou criar uma regra de permissão Bash
- [ ] Verificar domínio da Zuri no Resend e definir RESEND_FROM
- [ ] Rotacionar as chaves do Supabase e do Resend, pois foram coladas em uma conversa
- [ ] Testar WhatsApp e PDF em iPhone e Android
- [ ] Decidir sobre o desconto de condomínio (seção 4) continua em aberto

**Layout do PDF (atualizado depois)**
- Página 1: tabela, margem, miniaturas das fotos em uma linha e lista de documentos com a coluna "No arquivo".
- Páginas seguintes: fotos grandes, 2 por página, inteiras (object-fit contain) sobre fundo Limestone.
- Final do arquivo: documentos PDF (todas as páginas) e imagens PNG ou JPG, uma por página A4, via pdf-lib (api/_lib/anexos.js). Word, Excel, HEIC, WebP e arquivos corrompidos ficam só listados ("Somente listado").
- Preço de compra continua opcional (decisão final do usuário; a spec foi atualizada).
