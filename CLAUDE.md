# ZFlip — Instruções do Projeto

## Sobre o projeto

App web (PWA) para calcular a economia de negócios de flip imobiliário da Zuri Real Estate. A especificação técnica completa (fórmulas, tabela de IMT, estrutura de banco de dados, template da folha de proposta) está no arquivo `zflip_spec_claude_code.md`, nesta mesma pasta. Consultar esse arquivo antes de qualquer implementação, ele já cobre decisões de escopo já fechadas, não reabrir essas discussões sem motivo novo.

## Modelo e effort

- Modelo padrão: Sonnet
- Effort padrão: medium
- Subir para effort high apenas nestes dois casos específicos:
  - Configuração do Puppeteer/Chromium para gerar PDF dentro do ambiente serverless da Vercel
  - Lógica de teste de escalões de IMT na conta reversa (cálculo do preço máximo de compra)
- Depois de resolver a parte que exigiu effort high, voltar para medium
- Para ajustes triviais (cor, texto, pequenos consertos depois do app funcionando), usar effort low

## Modo de execução

- Trabalhar em modo conciso: executar sem narrar cada etapa intermediária, reportar o resultado quando terminar
- Só interromper para perguntar quando houver ambiguidade genuína, ou seja, quando prosseguir sem perguntar arriscaria fazer algo errado ou difícil de reverter (por exemplo, sobrescrever dados já salvos, apagar algo, mudar uma decisão de escopo já fechada na especificação)
- Não perguntar por: detalhes técnicos inferíveis do contexto, escolhas menores de formato ou estilo, passos intermédios óbvios
- Antes de construir algo do zero (autenticação, upload de arquivo, geração de PDF, envio de e-mail, integração com um serviço), verificar primeiro se existe um plugin, skill ou biblioteca já pronta e confiável para aquilo, em vez de escrever a solução na mão

## Segurança

- A chave secreta do Supabase (`SUPABASE_SECRET_KEY`) e a chave do Resend (`RESEND_API_KEY`) nunca podem aparecer em código que roda no navegador do celular, somente em variáveis de ambiente da Vercel, usadas dentro de Vercel Functions
- RLS (Row Level Security) deve ser ativado em toda tabela nova criada no Supabase, sem exceção, mesmo que pareça desnecessário no momento

## Idioma e estilo de escrita

- Português do Brasil em todo texto do app (interface, mensagens, e-mails gerados)
- Nunca usar hífens ou travessões, preferir vírgula, ponto, parênteses, ou reestruturar a frase
- Sem emojis em nenhum lugar do app ou da folha de proposta
