# ZFlip — Calculadora de Flip Imobiliário (Zuri Real Estate)

## Objetivo

App web (PWA, HTML/CSS/JS puro, sem framework) que roda em qualquer sistema operacional via navegador e pode ser instalado na tela inicial do celular. Recebe inputs de um negócio de flip imobiliário, calcula rentabilidade em dois sentidos simultâneos, e gera uma folha de proposta em PDF exportável por e-mail ou WhatsApp.

Empresa: Zuri Real Estate (nome usado como "COSMIKVARIETY" apenas no nome do arquivo fonte original, por ser anterior à mudança de nome; ignorar essa nomenclatura em todo o resto).

Base de referência: aba `02_ECONOMIA_NEGOCIO` do arquivo `Arjon_BP_COSMIKVARIETY_v16.xlsx`, com as premissas de `01_PREMISSAS` e a tabela de IMT de `07_IMT_2026`. Não usar o bloco de ritmo de compras nem o fluxo mensal de 60 meses, isso fica fora do escopo do app.

## Stack técnica

- Frontend: HTML + CSS + JavaScript puro (vanilla), sem React ou outro framework
- PWA instalável (manifest.json + service worker básico)
- Hospedagem e backend: Vercel, plano gratuito (evitar serviços com free trial que expira, como Railway, que foi o que travou a versão anterior do projeto), usando Vercel Functions para tudo que precisa rodar no servidor (nunca no celular do usuário)
- Banco de dados: Supabase (Postgres), projeto já criado (`ZFlipDB`, organização Zuri Real Estate, região Europe)
- Armazenamento de arquivos (fotos e documentos anexados a cada negócio): Supabase Storage
- Geração de PDF: no servidor, dentro de uma Vercel Function, não no navegador do celular (ver seção "Geração do PDF")
- Envio de e-mail com anexos: Resend, chamado a partir da mesma Vercel Function que gera o PDF
- Exportação por WhatsApp: Web Share API abrindo o WhatsApp nativo com o PDF anexado; fallback com link wa.me se o navegador não suportar Web Share API com arquivos

## Autenticação e segurança do backend

- O app não tem login de usuário nesta fase (uso interno, Guto e corretores da Zuri, sem conta individual)
- Todo acesso ao Supabase a partir do navegador do celular usa apenas a **Publishable key** (antiga "anon key"), que pode ficar exposta no código do frontend sem risco
- A **Secret key** (antiga "service_role key") do Supabase, e a API key do Resend, ficam **somente** como variáveis de ambiente na Vercel, nunca no código do frontend, nunca visíveis para quem usa o app
- RLS (Row Level Security) deve ser ativado manualmente em cada tabela ao criá-la (não depende de nenhuma configuração feita no momento de criação do projeto Supabase). Política inicial simples: nenhum acesso liberado para a chave pública (`anon`), todo acesso de leitura e escrita passa pela Secret key, usada só dentro das Vercel Functions
- Variáveis de ambiente a configurar na Vercel (nomes sugeridos, valores reais nunca documentados em texto):
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY` (pode ir também no frontend)
  - `SUPABASE_SECRET_KEY` (backend apenas)
  - `RESEND_API_KEY` (backend apenas)

## Inputs do formulário

Todos os campos abaixo devem ter os valores default indicados, mas serem editáveis pelo usuário.

| Campo | Tipo | Default | Observação |
|---|---|---|---|
| Preço de venda | € | — (obrigatório) | |
| Preço de compra | € | — (opcional) | Decisão final do usuário: sem preço de compra, só a conta reversa (preço máximo) é calculada e a coluna "Com preço de compra informado" mostra "Não informado" |
| Aplicar IMT? | Sim/Não (toggle) | Sim | Ver seção IMT abaixo |
| Comissão de venda | % | 5% | |
| IVA sobre comissão | % | 23% | |
| ROI alvo | % | 15% | |
| Prazo do negócio | meses | 4 | Aceita 0 (compra e venda no mesmo mês). Nunca gera erro nem divisão por zero, o prazo só multiplica, nunca divide, nas fórmulas usadas |
| Modo de remodelação | seletor: % sobre aquisição / valor direto (€) | % sobre aquisição | Usuário escolhe um dos dois modos, nunca os dois ao mesmo tempo |
| Remodelação | % ou € (conforme modo acima) | 12% | |
| Custos jurídicos | % sobre aquisição | 0,5% | |
| Escritura + registos | % sobre aquisição | 0,5% | |
| Imposto do Selo | % sobre aquisição | 0,8% | |
| Outros custos | % sobre aquisição | 1% | |
| IMI anual | % sobre aquisição | 0,32% | Rateado pelo prazo (ver fórmula) |

Campos fora do escopo (não incluir): prazo usado no ritmo de compras, condomínio, todo o bloco de ritmo de compras e capital em risco.

## Uploads de fotos e documentos

Além dos campos de cálculo, o formulário deve permitir anexar arquivos ao negócio, antes de gerar a folha de proposta:

- **Fotos do imóvel**: até 20, todas salvas no Supabase. A folha de proposta mostra miniaturas de todas na página 1 e só as até 4 principais (escolhidas pelo usuário) em página própria, grandes (decisão final do usuário)
- **Documentos associados**: quantidade livre (caderneta predial, certidão, plantas, avaliação, o que for), sem preview obrigatório na folha de proposta, só listados por nome

Fluxo técnico:

1. Usuário seleciona os arquivos no formulário (input type file, com preview de miniatura para as fotos)
2. Ao gerar a folha de proposta, os arquivos são enviados para o Supabase Storage, num bucket dedicado (por exemplo `documentos-negocios`), organizados numa pasta por negócio (usando o identificador único gerado no passo seguinte)
3. Um registro novo é criado na tabela `negocios` (ver seção "Estrutura do banco de dados"), guardando os inputs numéricos, os resultados calculados, e os caminhos dos arquivos no Storage
4. O PDF final referencia esses arquivos para montar a grade de fotos e a lista de documentos

## Estrutura do banco de dados (Supabase)

Tabela `negocios`, uma linha por negócio calculado e salvo:

- `id` (identificador único, gerado automaticamente)
- `criado_em` (data/hora automática)
- `preco_venda`, `preco_compra`, `aplicar_imt`, `comissao_venda_pct`, `iva_comissao_pct`, `roi_alvo_pct`, `prazo_meses`, `modo_remodelacao`, `remodelacao_valor_ou_pct`, `custos_juridicos_pct`, `escritura_registos_pct`, `imposto_selo_pct`, `outros_custos_pct`, `imi_anual_pct` (todos os inputs do formulário)
- `resultado_conta_direta` e `resultado_conta_reversa` (os dois blocos de output calculados, guardados como JSON, para não precisar recalcular ao reabrir o negócio depois)
- `fotos` (lista de caminhos no Supabase Storage, até 4)
- `documentos` (lista de caminhos no Supabase Storage, quantidade livre)

RLS ativado nessa tabela desde a criação, sem política de acesso público, acesso só via Secret key dentro das Vercel Functions.

## Tabela de IMT 2026 (Tabela III, Continente, Habitação não HPP)

Usada apenas quando "Aplicar IMT?" = Sim. Quando "Não", IMT = 0 em todas as contas, sem testar escalões.

| Escalão | Limite inferior (€) | Limite superior (€) | Taxa marginal | Parcela a abater (€) |
|---|---|---|---|---|
| 1 | 0 | 106.346 | 1% | 0 |
| 2 | 106.346 | 145.470 | 2% | 1.063,46 |
| 3 | 145.470 | 198.347 | 5% | 5.427,56 |
| 4 | 198.347 | 330.539 | 7% | 9.394,50 |
| 5 | 330.539 | 633.931 | 8% | 12.699,89 |
| 6 | 633.931 | 1.150.853 | 6% | 0 |
| 7 | 1.150.853 | ∞ | 7,5% | 0 |

IMT(preço) = preço × taxa_marginal_do_escalão − parcela_a_abater_do_escalão

## Motor de cálculo

### Termos auxiliares

```
k = custos_juridicos_pct + escritura_registos_pct + imposto_selo_pct + outros_custos_pct
    + (imi_anual_pct × prazo_meses / 12)

# Se modo remodelação = "% sobre aquisição": somar remodelacao_pct a k, e REM_FIXO = 0
# Se modo remodelação = "valor direto": REM_FIXO = valor informado, e remodelacao_pct NÃO entra em k

comissao_venda_com_iva = preco_venda × comissao_venda_pct × (1 + iva_comissao_pct)
receita_liquida_venda = preco_venda − comissao_venda_com_iva
```

### Conta 1 — Direta (usa o preço de compra informado pelo usuário)

```
if aplicar_imt:
    encontrar o escalão onde preco_compra está (limite_inferior <= preco_compra <= limite_superior)
    imt = preco_compra × taxa_do_escalão − parcela_a_abater_do_escalão
else:
    imt = 0

remodelacao = REM_FIXO se modo valor direto, senão remodelacao_pct × preco_compra
custos_juridicos = custos_juridicos_pct × preco_compra
total_outros_custos = (escritura_registos_pct + imposto_selo_pct + outros_custos_pct) × preco_compra
                       + (imi_anual_pct × preco_compra × prazo_meses / 12)
    # exibir este total compactado no output, como uma linha só "Total de outros custos"

capital_total_investido = preco_compra + remodelacao + custos_juridicos + total_outros_custos + imt
lucro_liquido_real = receita_liquida_venda − capital_total_investido
roi_real = lucro_liquido_real / capital_total_investido
compra_venda_pct = preco_compra / preco_venda
```

### Conta 2 — Reversa (preço máximo de compra para bater o ROI alvo, dado o preço de venda)

```
alvo = receita_liquida_venda / (1 + roi_alvo_pct)

if aplicar_imt:
    testar cada um dos 7 escalões de IMT (d = taxa, e = parcela a abater):
        preco_candidato = (alvo − REM_FIXO + e) / (1 + k + d)
        aceitar o candidato cujo preco_candidato caia dentro do próprio escalão testado
            (limite_inferior <= preco_candidato <= limite_superior)
    preco_maximo_compra = preco_candidato aceito
else:
    preco_maximo_compra = (alvo − REM_FIXO) / (1 + k)
    # sem teste de escalão, fórmula direta, IMT = 0

# a partir de preco_maximo_compra, recalcular todos os demais indicadores
# usando exatamente as mesmas fórmulas da Conta 1, substituindo preco_compra por preco_maximo_compra
```

## Output — Folha de proposta

Documento com identidade visual ZURI, gerado como HTML e convertido em PDF (ver seção "Geração do PDF").

Paleta ZURI a usar no template:

- Deep Forest #3E5148 para títulos e cabeçalho
- Mineral Green #68766D para elementos secundários
- Soft Stone #D9D5CC e Limestone #EEEAE2 para fundos claros e divisórias
- Não usar Black Ink #1E201E (excluído da identidade por ser pesado demais)
- Não usar nenhuma das taglines antigas da ZURI (ex.: "Revelar o Potencial"); tom formal e profissional, sem frases de marketing

Estrutura do documento, de cima para baixo:

1. Cabeçalho com identidade ZURI (cor de fundo, nome/logo se disponível)
2. Tabela de duas colunas lado a lado, uma para cada conta, custos compactados numa linha só:

| Indicador | Com preço de compra informado | Preço máximo (ROI alvo) |
|---|---|---|
| Preço de venda | | |
| Preço de compra | (informado pelo usuário) | (calculado) |
| Remodelação | | |
| Custos jurídicos | | |
| Total de outros custos | | |
| IMT | (ou "Isento" se aplicar_imt = Não) | |
| Comissão de venda + IVA | | |
| Capital total investido | | |
| Lucro líquido | | |
| Receita líquida da venda | | |
| ROI sobre capital investido | | |
| Compra / Venda | | |

3. Indicação visual da margem entre o preço de compra informado e o preço máximo calculado (quanto o negócio está abaixo ou acima do que faria sentido pagar)
4. Grade de até 4 fotos do imóvel, lado a lado, se existirem
5. Lista dos documentos anexados (nome do arquivo, tipo)
6. Rodapé com data de geração e o identificador do negócio (o `id` salvo no banco), para depois cruzar com o registro completo no Supabase

## Geração do PDF

Gerado no servidor, não no navegador do celular, pelos motivos de qualidade e consistência entre aparelhos:

1. O celular envia os dados do negócio (inputs, resultados, caminhos das fotos e documentos no Supabase Storage) para uma Vercel Function
2. A função monta o HTML da folha de proposta acima, com o CSS da identidade ZURI já embutido
3. Um navegador headless (por exemplo Puppeteer, com `@sparticuz/chromium` para rodar dentro do ambiente serverless da Vercel) renderiza esse HTML e converte para PDF
4. O PDF gerado é salvo no Supabase Storage, associado ao registro do negócio na tabela `negocios`
5. O mesmo PDF é usado tanto para download/compartilhamento via WhatsApp quanto como anexo do e-mail enviado pelo Resend

## Exportação

- Botão "Gerar PDF" chama a Vercel Function acima, recebe o PDF pronto
- Botão "Enviar por e-mail" chama a Vercel Function que usa a API do Resend para enviar o e-mail com o PDF anexado, remetente configurável (hoje um e-mail de teste, futuramente um domínio verificado da Zuri Real Estate dentro do Resend)
- Botão "Enviar por WhatsApp" abre o WhatsApp nativo com o PDF anexado (Web Share API, fallback wa.me)
