// Template HTML da folha de proposta, convertido em PDF pelo Chromium em api/pdf.js.
// Colunas na mesma ordem da tela: preço máximo primeiro (decisão da sessão de 16/09).
// Paleta ZURI: Deep Forest, Mineral Green, Soft Stone, Limestone (sem Black Ink).

const LINHAS = [
  { key: 'preco_venda', label: 'Preço de venda', tipo: 'euro' },
  { key: 'preco_compra', label: 'Preço de compra', tipo: 'euro' },
  { key: 'remodelacao', label: 'Remodelação', tipo: 'euro' },
  { key: 'custos_juridicos', label: 'Custos jurídicos', tipo: 'euro' },
  { key: 'total_outros_custos', label: 'Total de outros custos', tipo: 'euro' },
  { key: 'imt', label: 'IMT', tipo: 'euro', isento: true },
  { key: 'comissao_venda_com_iva', label: 'Comissão de venda + IVA', tipo: 'euro' },
  { key: 'capital_total_investido', label: 'Capital total investido', tipo: 'euro', destaque: true },
  { key: 'lucro_liquido', label: 'Lucro líquido', tipo: 'euro', destaque: true },
  { key: 'receita_liquida_venda', label: 'Receita líquida da venda', tipo: 'euro' },
  { key: 'roi', label: 'ROI sobre capital investido', tipo: 'pct', destaque: true },
  { key: 'compra_venda_pct', label: 'Compra / Venda', tipo: 'pct' },
];

const fmtEuro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(v);
const fmtPct = v => new Intl.NumberFormat('pt-PT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function valor(conta, linha, aplicarImt) {
  if (!conta) return 'Não informado';
  if (linha.isento && !aplicarImt) return 'Isento';
  return linha.tipo === 'pct' ? fmtPct(conta[linha.key]) : fmtEuro(conta[linha.key]);
}

function blocoMargem(direta, reversa) {
  const maximo = reversa.preco_compra;
  if (!direta) {
    return `<div class="margem"><p class="margem-texto">Preço máximo de compra para atingir o ROI alvo: <strong>${fmtEuro(maximo)}</strong></p></div>`;
  }
  const informado = direta.preco_compra;
  const diff = maximo - informado;
  const diffPct = maximo !== 0 ? Math.abs(diff / maximo) : 0;
  const abaixo = diff >= 0;
  const escala = Math.max(maximo, informado, 1);
  const texto = abaixo
    ? `O preço informado está <strong>${fmtEuro(Math.abs(diff))} (${fmtPct(diffPct)}) abaixo</strong> do preço máximo para o ROI alvo.`
    : `O preço informado está <strong>${fmtEuro(Math.abs(diff))} (${fmtPct(diffPct)}) acima</strong> do preço máximo para o ROI alvo.`;
  return `
  <div class="margem ${abaixo ? 'ok' : 'alerta'}">
    <p class="margem-texto">${texto}</p>
    <div class="barra-linha"><span class="barra-rotulo">Preço máximo (ROI alvo)</span>
      <div class="barra"><div class="seg maximo" style="width:${(maximo / escala) * 100}%"></div></div>
      <span class="barra-valor">${fmtEuro(maximo)}</span></div>
    <div class="barra-linha"><span class="barra-rotulo">Preço informado</span>
      <div class="barra"><div class="seg informado" style="width:${(informado / escala) * 100}%"></div></div>
      <span class="barra-valor">${fmtEuro(informado)}</span></div>
  </div>`;
}

function tipoDoNome(nome) {
  const ext = nome.includes('.') ? nome.split('.').pop().toUpperCase() : '';
  return ext || 'Arquivo';
}

// fotos: lista de data URIs já baixados do Storage
// docs: [{ nome, incluido }], incluido = true quando o documento entra como páginas no final do PDF
export function renderProposta(negocio, fotos, docs = []) {
  const direta = negocio.resultado_conta_direta;
  const reversa = negocio.resultado_conta_reversa;
  const aplicarImt = negocio.aplicar_imt;
  const data = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Lisbon',
  }).format(new Date());

  const linhas = LINHAS.map(l => `
      <tr class="${l.destaque ? 'destaque' : ''}">
        <td>${l.label}</td>
        <td>${valor(reversa, l, aplicarImt)}</td>
        <td>${valor(direta, l, aplicarImt)}</td>
      </tr>`).join('');

  const gradeFotos = fotos.length ? `
    <section class="bloco evitar-quebra">
      <h2>Fotos do imóvel</h2>
      <div class="fotos n${fotos.length}">
        ${fotos.map(src => `<div class="foto"><img src="${src}"></div>`).join('')}
      </div>
    </section>` : '';

  const paginasFotos = [];
  for (let i = 0; i < fotos.length; i += 2) {
    const par = fotos.slice(i, i + 2);
    paginasFotos.push(`
    <section class="pagina-fotos">
      <div class="pagina-topo"><span class="pagina-marca">ZURI</span><span>Fotos do imóvel, ${i + 1}${par.length > 1 ? ' e ' + (i + 2) : ''} de ${fotos.length}</span></div>
      ${par.map(src => `<div class="foto-grande"><img src="${src}"></div>`).join('')}
    </section>`);
  }

  const listaDocs = docs.length ? `
    <section class="bloco evitar-quebra">
      <h2>Documentos anexados</h2>
      <table class="docs">
        <thead><tr><th>Arquivo</th><th>Tipo</th><th>No arquivo</th></tr></thead>
        <tbody>
          ${docs.map(d => `<tr><td>${esc(d.nome)}</td><td>${esc(tipoDoNome(d.nome))}</td><td>${d.incluido ? 'Nas páginas seguintes' : 'Somente listado'}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=block" rel="stylesheet">
<style>
  :root {
    --forest: #3E5148;
    --mineral: #68766D;
    --stone: #D9D5CC;
    --limestone: #EEEAE2;
  }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    color: var(--forest);
    font-size: 10.5pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  header {
    background: var(--forest);
    color: var(--limestone);
    padding: 28px 48px 22px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .marca { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 34pt; letter-spacing: 0.32em; line-height: 1; font-weight: 600; }
  .marca-sub { font-size: 8pt; letter-spacing: 0.4em; text-transform: uppercase; margin-top: 8px; color: var(--stone); }
  .titulo-doc { text-align: right; font-size: 9pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--stone); }
  .titulo-doc strong { display: block; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 18pt; letter-spacing: 0.04em; text-transform: none; color: var(--limestone); font-weight: 500; margin-top: 4px; }
  main { padding: 22px 48px 0; }
  h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; font-size: 15pt; margin: 0 0 12px; color: var(--forest); }
  .bloco { margin-bottom: 20px; }
  .evitar-quebra { break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  .contas th { text-align: right; font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mineral); font-weight: 600; padding: 0 12px 10px; border-bottom: 1.5px solid var(--forest); }
  .contas th:first-child { text-align: left; padding-left: 0; }
  .contas td { padding: 5.5px 12px; border-bottom: 1px solid var(--stone); text-align: right; font-variant-numeric: tabular-nums; }
  .contas td:first-child { text-align: left; padding-left: 0; color: var(--mineral); }
  .contas tr.destaque td { background: var(--limestone); font-weight: 600; color: var(--forest); }
  .contas tr.destaque td:first-child { padding-left: 10px; }
  .margem { background: var(--limestone); border-left: 3px solid var(--forest); padding: 14px 18px; }
  .margem.alerta { border-left-color: #9A5B4A; }
  .margem-texto { margin: 0 0 12px; }
  .margem .margem-texto:last-child { margin: 0; }
  .barra-linha { display: grid; grid-template-columns: 150px 1fr 90px; align-items: center; gap: 12px; margin-top: 6px; font-size: 9pt; }
  .barra-rotulo { color: var(--mineral); }
  .barra-valor { text-align: right; font-variant-numeric: tabular-nums; }
  .barra { height: 10px; background: var(--stone); border-radius: 5px; overflow: hidden; }
  .seg { height: 100%; border-radius: 5px; }
  .seg.maximo { background: var(--forest); }
  .seg.informado { background: var(--mineral); }
  .fotos { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .fotos.n1 { grid-template-columns: 1fr; }
  .fotos.n2 { grid-template-columns: repeat(2, 1fr); }
  .fotos.n3 { grid-template-columns: repeat(3, 1fr); }
  .foto { aspect-ratio: 3 / 2; overflow: hidden; background: var(--stone); }
  .fotos.n1 .foto { aspect-ratio: 16 / 9; }
  .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .docs th { text-align: left; font-size: 8pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mineral); font-weight: 600; padding: 0 0 8px; border-bottom: 1.5px solid var(--forest); }
  .docs td { padding: 5px 0; border-bottom: 1px solid var(--stone); }
  .docs td:nth-child(n+2), .docs th:nth-child(n+2) { text-align: right; color: var(--mineral); white-space: nowrap; }
  .docs td:nth-child(2), .docs th:nth-child(2) { width: 70px; }
  .docs td:nth-child(3), .docs th:nth-child(3) { width: 170px; }
  .pagina-fotos { break-before: page; padding: 40px 48px 0; height: 297mm; overflow: hidden; }
  .pagina-topo { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 10px; margin-bottom: 18px; border-bottom: 1.5px solid var(--forest); font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mineral); }
  .pagina-marca { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16pt; letter-spacing: 0.32em; color: var(--forest); font-weight: 600; }
  .foto-grande { height: 118mm; margin-bottom: 14px; background: var(--limestone); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .foto-grande img { max-width: 100%; max-height: 100%; display: block; }
  footer { margin: 4px 48px 0; padding: 12px 0 24px; border-top: 1px solid var(--stone); display: flex; justify-content: space-between; font-size: 8pt; color: var(--mineral); }
</style>
</head>
<body>
  <header>
    <div>
      <div class="marca">ZURI</div>
      <div class="marca-sub">Real Estate</div>
    </div>
    <div class="titulo-doc">Folha de proposta<strong>Análise de flip imobiliário</strong></div>
  </header>
  <main>
    <section class="bloco">
      <table class="contas">
        <thead><tr><th>Indicador</th><th>Preço máximo (ROI alvo)</th><th>Com preço de compra informado</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </section>
    <section class="bloco evitar-quebra">
      <h2>Margem de negociação</h2>
      ${blocoMargem(direta, reversa)}
    </section>
    ${gradeFotos}
    ${listaDocs}
  </main>
  <footer>
    <span>Gerado em ${esc(data)}</span>
    <span>Negócio ${esc(negocio.id)}</span>
  </footer>
  ${paginasFotos.join('')}
</body>
</html>`;
}
