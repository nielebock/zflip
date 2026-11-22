# Handoff: ZFlip 2.0 (SharePoint em produção, ajustes de produto)

**Data:** 2026-11-22
**Status:** ZFlip 2.0 em produção, testado de ponta a ponta com arquivos reais. O app antigo (Supabase) não é mais considerado relevante pelo usuário, mas segue intacto e no ar em paralelo.

---

## 1. Objetivo

Continuar o ZFlip 2.0 (calculadora de flip imobiliário da Zuri Real Estate, ver `CLAUDE.md` e `zflip_spec_claude_code.md`) depois da migração de backend (Supabase → Neon + SharePoint, ver handoff anterior de 13/10 no histórico do git). Esta sessão cobriu: concluir a integração com o SharePoint, corrigir dois bugs reais achados ao testar com arquivos de verdade no celular, e três pedidos de produto (quem criou a proposta, IMT desligado por padrão, preço por m²).

## 2. Contexto essencial

- **Branch de trabalho: `zflip2-neon`** (não `main`, que é o app antigo). Vercel: projeto `zflip2.0`. Domínio: `https://zflip.zurirealestate.com`.
- `neon/LEIA-ME.md` é a fonte de verdade viva do estado da migração, mais detalhada que este handoff em tudo que é específico de infraestrutura (Neon, Vercel, SharePoint, Resend). Ler antes de mexer em `api/_lib/armazenamento.js`, `api/_lib/graph.js` ou `api/_lib/db.js`.
- **Usuário já não considera mais o app antigo (Supabase) relevante**: perguntado explicitamente nesta sessão se as mudanças de produto deveriam ir para os dois apps, ele disse para aplicar nos dois "se fizer sentido manter", mas deixou claro que o antigo não importa mais. Na prática, só o `zflip2-neon` recebeu as mudanças desta sessão.
- **Toda alteração de schema no Neon precisa ser pedida ao usuário via SQL Editor** (esta sessão não tem acesso direto ao banco). Sempre dar o `ALTER TABLE` pronto para copiar e colar.
- **Deploy é automático a cada `git push` na branch**, não precisa pedir redeploy manual. Para confirmar que propagou, checar via `curl` no próprio domínio de produção (ex.: `curl -sS https://zflip.zurirealestate.com/index.html | grep -c 'id="algum_campo_novo"'`), porque o acesso ao MCP da Vercel para listar deployments variou de uma sessão para outra (às vezes dá 403, sem explicação clara do porquê).
- **Cache do PWA no celular**: depois de um deploy, o celular pode continuar rodando o JavaScript antigo se o app ficou aberto em segundo plano. Sempre orientar o usuário a fechar o app completamente (deslizar para fora no seletor de apps) e abrir de novo antes de testar algo novo.

## 3. O que já foi feito nesta sessão, em ordem

### SharePoint: autenticação e teste de ponta a ponta

1. Usuário recebeu do TI as credenciais do app registrado no Entra ID (Client ID, Tenant ID, Client Secret) e o endereço real do SharePoint: site `arjonholding.sharepoint.com/sites/ZURI-FINANCEIRO`, pasta `ZURI - Novos Investimentos/ZURI - Propostas` dentro da biblioteca "Documentos Compartilhados" (diferente do que tinha sido assumido antes, que era só "Zuri - Propostas" na raiz).
2. Implementado `api/_lib/graph.js` (cliente mínimo do Microsoft Graph, autenticação client credentials, cache de token e de drive ID) e reescrito `api/_lib/armazenamento.js` para orquestrar: fotos/documentos continuam subindo do celular para o Vercel Blob (contorna o limite de 4,5 MB da função), e ao gerar o PDF, uma função nova (`migrarParaSharePoint`) copia tudo para a subpasta da proposta (nomeada pela tag) no SharePoint e apaga a cópia temporária do Blob.
3. **Decisão de arquitetura perguntada ao usuário antes de implementar**: manter o Blob como etapa intermediária do upload direto do celular (impossível contornar o limite de 4,5 MB de outro jeito sem expor o client secret no navegador), copiando para o SharePoint só na hora de gerar o PDF. Usuário confirmou essa opção.
4. **Sequência de bugs reais, todos diagnosticados com o método "expor o erro real temporariamente, corrigir, reverter o diagnóstico"**:
   - Colisão de nome de variável em `api/pdf.js` (`const [fotos, ...]` da migração vs. `const fotos` já existente) quebrava a função inteira com erro cru, sem log útil.
   - `401 invalid_client` do Microsoft Graph: o e-mail do TI tinha os campos "KEY" e "VALUE" com os nomes trocados em relação ao portal do Entra (o "VALUE" do TI era na verdade o Secret ID, um GUID; o "KEY" era o Secret Value de verdade). Resolvido depois de comparar os formatos (GUID vs. string com `~`).
   - Mesmo depois de corrigir o valor, persistia o erro: era espaço/quebra de linha colado junto ao secret (mesma classe de bug já vista com a `RESEND_API_KEY` antes). Corrigido com `.trim()` nas três variáveis de ambiente do SharePoint.
5. Testado de ponta a ponta com sucesso: criar negócio → gerar PDF → migrar para o SharePoint → ler de volta para enviar e-mail.

### Dois bugs achados testando com arquivos de verdade no celular

6. **Upload de foto/documento falhava sempre, com qualquer rede (wifi, dados, sinal cheio)**: a mensagem genérica "Falha ao enviar X" escondia o motivo real. Depois de expor `e?.message`, apareceu: `Vercel Blob: client/upload doesn't allow addRandomSuffix`. `js/exportar.js` repetia do lado do navegador uma opção que só pode ser definida no servidor (`api/blob-upload.js` já define `addRandomSuffix: false` em `onBeforeGenerateToken`). Esse bug existia desde a migração para o Blob, só nunca tinha sido exercido porque os testes anteriores (via `curl`) não enviavam arquivos de verdade. Corrigido removendo a opção duplicada do lado do cliente.
7. **Link do PDF pedia login de conta Microsoft da Zuri**: ao devolver a URL do SharePoint (`item.webUrl`) direto para o app, quem recebe a proposta por e-mail ou WhatsApp (cliente, investidor, geralmente sem conta Microsoft da Zuri) não conseguia abrir. Corrigido criando `api/arquivo.js` (endpoint `GET /api/arquivo?id=...`), que busca o PDF no SharePoint com as credenciais do app e serve pelo próprio domínio do ZFlip. `api/pdf.js` agora devolve essa URL, nunca a do SharePoint direto.
8. Usuário confirmou os dois fixes funcionando, testando com fotos e documentos reais no iPhone.

### Três pedidos de produto

9. **Tag de quem criou a proposta**: campo "Criado por" adicionado na mesma janela onde se digita o nome do imóvel (antes de gerar o PDF). Salvo em `public.negocios.criado_por`, lembrado no aparelho entre propostas via `localStorage` (não precisa digitar toda vez). Pedido do usuário para reposicionar: inicialmente mostrado no rodapé do PDF, movido depois para uma faixa logo abaixo do cabeçalho verde (header) da folha de proposta.
10. **IMT desligado por padrão**: o botão "Aplicar IMT?" no formulário agora começa desmarcado (antes vinha marcado por padrão).
11. **Preço por m²**: novo campo opcional "Área do imóvel (m²)" no formulário (`area_m2`, nova coluna em `public.negocios`). Quando preenchido, tanto a tela quanto o PDF mostram duas linhas extras na tabela de contas ("Preço de venda por m²" e "Preço de compra por m²"), calculadas para as duas colunas (preço máximo e preço informado). Sem área, essas linhas somem (não aparecem zeradas nem com erro).

**Pergunta feita ao usuário e resposta, registrada para não repetir**: antes de implementar os três pedidos de produto, perguntei se eram para o ZFlip 2.0, o app antigo, ou os dois. Resposta: só o ZFlip 2.0 importa agora, o antigo não é mais considerado relevante (mas não foi formalmente descontinuado).

## 4. Estado atual

**Funciona, confirmado em produção com testes reais pelo usuário no celular**
- Criar negócio, gerar PDF, migrar fotos/documentos/PDF para o SharePoint, enviar e-mail lendo do SharePoint.
- Link do PDF abre sem pedir login.
- Upload de fotos e documentos reais pelo iPhone.
- PWA instalado com ícone, testado no iPhone (instruções passo a passo já dadas; Android ainda não confirmado pelo usuário, mas o fluxo de instalação é equivalente).
- Campo "Criado por" aparecendo na proposta, IMT desligado por padrão, preço por m² calculado quando a área é informada.

**Não confirmado**
- WhatsApp e Abrir/Compartilhar PDF num Android de verdade (só confirmado no iPhone).
- Se o usuário já apagou as chaves antigas do Resend no painel (pendência que vem desde a sessão de 13-14/10).

**Pendente de limpeza**
- Usuário confirmou nesta sessão que já rodou todos os `ALTER TABLE` pedidos (`criado_por`, `area_m2`) e os `DELETE`/`RESTART SEQUENCE` de limpeza de negócios de teste anteriores. Schema do Neon deveria estar em dia com `neon/001_schema.sql` neste momento.

## 5. Próximos passos

1. Perguntar ou confirmar se as chaves antigas do Resend já foram apagadas no painel.
2. Testar no Android de verdade (instalação como PWA, WhatsApp, compartilhar PDF), já que só foi confirmado no iPhone.
3. Decidir, em algum momento, se o app antigo (Supabase, branch `main`, `zflip-eosin.vercel.app`) é formalmente desligado, já que o usuário disse não considerá-lo mais relevante.
4. Qualquer novo pedido de produto: confirmar primeiro se é só para o `zflip2-neon` (como ficou combinado nesta sessão) antes de tocar no app antigo.

## 6. Perguntas em aberto

1. O app antigo (Supabase) deve ser desligado formalmente, ou só abandonado sem mexer?
2. Vale a pena migrar os negócios de teste do Supabase antigo para o Neon, para manter histórico, ou começar do zero é melhor?

## 7. Artefatos relevantes

**Branch e projetos**
- Repositório: `nielebock/zflip`, branch `zflip2-neon` (branch designada desta sessão de trabalho)
- Vercel: projeto `zflip2.0`, domínio `https://zflip.zurirealestate.com`
- Neon: projeto `zflip2.0`
- SharePoint: site `arjonholding.sharepoint.com/sites/ZURI-FINANCEIRO`, pasta `ZURI - Novos Investimentos/ZURI - Propostas` (biblioteca "Documentos Compartilhados")

**Arquivos principais (novos ou centrais desta sessão)**
```
api/_lib/graph.js            cliente Microsoft Graph (autenticação, token, drive ID)
api/_lib/armazenamento.js     orquestra Blob (upload direto do celular) + SharePoint (destino final)
api/arquivo.js                GET /api/arquivo?id=... serve o PDF do SharePoint sem exigir login
api/pdf.js                    gera PDF, migra fotos/documentos/PDF pro SharePoint, devolve url de api/arquivo.js
js/exportar.js                fluxo de upload do celular (sem addRandomSuffix duplicado), pede nome + criado_por
api/_lib/proposta.js          template do PDF: linhas de €/m², faixa "criado por" abaixo do cabeçalho
neon/001_schema.sql            schema de referência (criado_por, area_m2 adicionados)
neon/LEIA-ME.md                documentação viva da migração, atualizada nesta sessão
```

**Comandos úteis**
```
# Confirmar que um deploy propagou (sem depender do MCP da Vercel, que às vezes nega acesso):
curl -sS https://zflip.zurirealestate.com/index.html | grep -c 'id="algum_campo_novo"'

# Testar a API em produção direto:
curl -X POST https://zflip.zurirealestate.com/api/negocio -H "Content-Type: application/json" -d '{...}'
curl -X POST https://zflip.zurirealestate.com/api/pdf -H "Content-Type: application/json" -d '{"id":"..."}'
curl -X POST https://zflip.zurirealestate.com/api/email -H "Content-Type: application/json" -d '{"id":"...","para":"..."}'
```

## 8. Instruções pra próxima sessão

- Ler `CLAUDE.md`, `zflip_spec_claude_code.md` e `neon/LEIA-ME.md` primeiro (nessa ordem). O `LEIA-ME.md` é mais detalhado que este handoff em tudo de infraestrutura (Neon, Vercel, SharePoint).
- **Confirmar a branch antes de mexer em qualquer coisa**: `git branch --show-current` deve dar `zflip2-neon`. A branch designada automaticamente para a sessão pode vir diferente (já aconteceu de a sessão abrir no `main`, que é o app antigo); nesse caso, `git fetch origin zflip2-neon && git checkout zflip2-neon` antes de qualquer edição.
- Esta sessão não tem acesso direto ao banco do Neon: toda mudança de schema precisa de um `ALTER TABLE` pronto, pedido ao usuário rodar no SQL Editor (ensinar a abrir uma aba nova com o `+`, sem sobrescrever consultas salvas).
- O acesso ao MCP da Vercel para listar deployments e variáveis de ambiente é inconsistente entre sessões (funciona numa, dá 403 em outra, sem padrão claro). Não depender dele: confirmar deploys via `curl` direto no domínio de produção.
- **Nunca criar endpoint administrativo sem autenticação** (apagar dados, etc.), mesmo temporário: o classificador de segurança do ambiente bloqueia. Pedir para o usuário rodar SQL manualmente é o caminho certo.
- **Nunca tentar diagnosticar o conteúdo de uma secret expondo características dela** (tamanho, caracteres) numa resposta pública, mesmo sem revelar o valor. Se uma secret está suspeita, a resposta certa é recriá-la ou aplicar `.trim()` defensivo, não investigá-la.
- Metodologia que funcionou bem nesta sessão para bugs difíceis: expor `e?.message` (ou detalhes do erro) temporariamente numa resposta de API, reproduzir o problema, diagnosticar pela mensagem real, corrigir, e só então reverter o diagnóstico antes do commit final. Não deixar diagnóstico temporário em produção por mais que o necessário.
- Antes de implementar um pedido de produto, confirmar se é só para o ZFlip 2.0 ou também para o app antigo (nesta sessão o usuário deixou claro que só o ZFlip 2.0 importa, mas perguntar de novo se não estiver óbvio pelo contexto).
- Modo de trabalho do usuário: conciso, direto, testa em produção de verdade no próprio celular, dá print de tela quando algo dá errado (ler a mensagem de erro exibida no app, que geralmente aparece em vermelho na parte de baixo da tela).
- Nunca usar hífens nem travessões em texto visível ao usuário, nem emojis (regra do `CLAUDE.md` do projeto).
