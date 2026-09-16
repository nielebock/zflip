const form = document.getElementById('flip-form');
const resultCard = document.getElementById('result-card');
const resultTableBody = document.querySelector('#result-table tbody');
const marginViz = document.getElementById('margin-viz');
const modoRemodelacaoSel = document.getElementById('modo_remodelacao');
const labelRemodelacao = document.getElementById('label-remodelacao');
const remodelacaoInput = document.getElementById('remodelacao_valor');
const precoVendaInput = document.getElementById('preco_venda');
const precoVendaError = document.getElementById('error-preco_venda');
const btnCalcular = document.getElementById('btn-calcular');
const exportModal = document.getElementById('export-modal');
const exportNomeImovelInput = document.getElementById('export-nome-imovel');

let lastResult = null;
let lastInputs = null;
let pendingExportKind = null;

const FORM_STORAGE_KEY = 'zflip:last-form';

function saveFormToStorage() {
  try {
    const data = {};
    Array.from(form.elements).forEach(el => {
      if (!el.name) return;
      data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
  } catch (err) { /* storage indisponível, ignora */ }
}

function restoreFormFromStorage() {
  try {
    const raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.keys(data).forEach(name => {
      const el = form.elements[name];
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = data[name];
      } else {
        el.value = data[name];
      }
    });
    modoRemodelacaoSel.dispatchEvent(new Event('change'));
  } catch (err) { /* storage indisponível, ignora */ }
}

restoreFormFromStorage();
updateCalcularButtonState();

modoRemodelacaoSel.addEventListener('change', () => {
  if (modoRemodelacaoSel.value === 'fixo') {
    labelRemodelacao.textContent = 'Remodelação (€)';
    remodelacaoInput.step = '0.01';
  } else {
    labelRemodelacao.textContent = 'Remodelação (%)';
    remodelacaoInput.step = '0.01';
  }
});

function toNum(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function toNumOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function pct(v) {
  return toNum(v) / 100;
}

function readInputs() {
  return {
    preco_venda: toNum(form.preco_venda.value),
    preco_compra: toNumOrNull(form.preco_compra.value),
    aplicar_imt: form.aplicar_imt.checked,
    comissao_venda_pct: pct(form.comissao_venda_pct.value),
    iva_comissao_pct: pct(form.iva_comissao_pct.value),
    roi_alvo_pct: pct(form.roi_alvo_pct.value),
    prazo_meses: toNum(form.prazo_meses.value),
    modo_remodelacao: form.modo_remodelacao.value,
    remodelacao_valor: form.modo_remodelacao.value === 'fixo'
      ? toNum(form.remodelacao_valor.value)
      : pct(form.remodelacao_valor.value),
    custos_juridicos_pct: pct(form.custos_juridicos_pct.value),
    escritura_registos_pct: pct(form.escritura_registos_pct.value),
    imposto_selo_pct: pct(form.imposto_selo_pct.value),
    outros_custos_pct: pct(form.outros_custos_pct.value),
    imi_anual_pct: pct(form.imi_anual_pct.value),
  };
}

function fmtEuro(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
}

const ROWS = [
  { key: 'preco_venda', label: 'Preço de venda', fmt: fmtEuro },
  { key: 'preco_compra', label: 'Preço de compra', fmt: fmtEuro },
  { key: 'remodelacao', label: 'Remodelação', fmt: fmtEuro },
  { key: 'custos_juridicos', label: 'Custos jurídicos', fmt: fmtEuro },
  { key: 'total_outros_custos', label: 'Total de outros custos', fmt: fmtEuro },
  { key: 'imt', label: 'IMT', fmt: fmtEuro, isento: true },
  { key: 'comissao_venda_com_iva', label: 'Comissão de venda + IVA', fmt: fmtEuro },
  { key: 'capital_total_investido', label: 'Capital total investido', fmt: fmtEuro },
  { key: 'lucro_liquido', label: 'Lucro líquido', fmt: fmtEuro },
  { key: 'receita_liquida_venda', label: 'Receita líquida da venda', fmt: fmtEuro },
  { key: 'roi', label: 'ROI sobre capital investido', fmt: fmtPct },
  { key: 'compra_venda_pct', label: 'Compra / Venda', fmt: fmtPct },
];

function renderResults(result, inputs) {
  resultTableBody.innerHTML = '';
  const { conta1, conta2 } = result;

  ROWS.forEach(row => {
    const tr = document.createElement('tr');
    const tdLabel = document.createElement('td');
    tdLabel.textContent = row.label;
    tr.appendChild(tdLabel);

    const tdMaximo = document.createElement('td');
    if (row.isento && !inputs.aplicar_imt) {
      tdMaximo.textContent = 'Isento';
    } else {
      tdMaximo.textContent = row.fmt(conta2[row.key]);
    }
    tr.appendChild(tdMaximo);

    const tdInformado = document.createElement('td');
    if (!conta1) {
      tdInformado.textContent = '—';
    } else if (row.isento && !inputs.aplicar_imt) {
      tdInformado.textContent = 'Isento';
    } else {
      tdInformado.textContent = row.fmt(conta1[row.key]);
    }
    tr.appendChild(tdInformado);

    resultTableBody.appendChild(tr);
  });

  renderMarginViz(conta1 ? conta1.preco_compra : null, conta2.preco_compra);
  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderMarginViz(precoInformado, precoMaximo) {
  marginViz.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'margin-bar-wrap';

  if (precoInformado === null) {
    const label = document.createElement('p');
    label.className = 'margin-label';
    label.textContent = `Preço máximo de compra para o ROI alvo: ${fmtEuro(precoMaximo)}`;
    wrap.appendChild(label);
    marginViz.appendChild(wrap);
    return;
  }

  const diff = precoMaximo - precoInformado;
  const diffPct = precoMaximo !== 0 ? diff / precoMaximo : 0;
  const abaixo = diff >= 0;

  const label = document.createElement('p');
  label.className = 'margin-label ' + (abaixo ? 'positive' : 'negative');
  label.textContent = abaixo
    ? `Preço informado está ${fmtEuro(Math.abs(diff))} (${fmtPct(Math.abs(diffPct))}) ABAIXO do máximo — margem de segurança`
    : `Preço informado está ${fmtEuro(Math.abs(diff))} (${fmtPct(Math.abs(diffPct))}) ACIMA do máximo para o ROI alvo`;
  wrap.appendChild(label);

  const bar = document.createElement('div');
  bar.className = 'margin-bar';
  const max = Math.max(precoInformado, precoMaximo, 1);
  const barMaximo = document.createElement('div');
  barMaximo.className = 'margin-segment maximo';
  barMaximo.style.width = `${(precoMaximo / max) * 100}%`;
  barMaximo.title = `Preço máximo: ${fmtEuro(precoMaximo)}`;
  bar.appendChild(barMaximo);
  wrap.appendChild(bar);

  const bar2 = document.createElement('div');
  bar2.className = 'margin-bar';
  const barInformado = document.createElement('div');
  barInformado.className = 'margin-segment informado';
  barInformado.style.width = `${(precoInformado / max) * 100}%`;
  barInformado.title = `Preço informado: ${fmtEuro(precoInformado)}`;
  bar2.appendChild(barInformado);
  wrap.appendChild(bar2);

  const legend = document.createElement('div');
  legend.className = 'margin-legend';
  legend.innerHTML = `
    <span><i class="dot maximo"></i> Preço máximo (ROI alvo): ${fmtEuro(precoMaximo)}</span>
    <span><i class="dot informado"></i> Preço informado: ${fmtEuro(precoInformado)}</span>
  `;
  wrap.appendChild(legend);

  marginViz.appendChild(wrap);
}

function setPrecoVendaInvalid(invalid) {
  precoVendaInput.classList.toggle('invalid', invalid);
  precoVendaError.hidden = !invalid;
}

function updateCalcularButtonState() {
  const preenchido = precoVendaInput.value.trim() !== '';
  btnCalcular.disabled = !preenchido;
  if (preenchido) setPrecoVendaInvalid(false);
}

precoVendaInput.addEventListener('input', updateCalcularButtonState);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (precoVendaInput.value.trim() === '') {
    setPrecoVendaInvalid(true);
    precoVendaInput.focus();
    return;
  }
  setPrecoVendaInvalid(false);
  const inputs = readInputs();
  const result = calcularZFlip(inputs);
  lastResult = result;
  lastInputs = inputs;
  renderResults(result, inputs);
  saveFormToStorage();
});

function slugifyNomeImovel(nome) {
  const base = nome.trim() || 'proposta-zflip';
  return base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'proposta-zflip';
}

function buildExportFilename(nome) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const data = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const hora = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${slugifyNomeImovel(nome)}_${data}_${hora}.pdf`;
}

function openExportModal(kind) {
  if (!lastResult) return;
  pendingExportKind = kind;
  exportModal.hidden = false;
  exportNomeImovelInput.focus();
}

function closeExportModal() {
  exportModal.hidden = true;
  pendingExportKind = null;
}

document.querySelectorAll('[data-export]').forEach(btn => {
  btn.addEventListener('click', () => openExportModal(btn.dataset.export));
});

document.getElementById('export-cancel').addEventListener('click', closeExportModal);

document.getElementById('export-confirm').addEventListener('click', async () => {
  const kind = pendingExportKind;
  const nomeImovel = exportNomeImovelInput.value.trim();
  const filename = buildExportFilename(nomeImovel);
  closeExportModal();

  if (kind === 'pdf') {
    gerarPdfProposta(lastResult, lastInputs, ROWS, { fmtEuro, fmtPct }, { nomeImovel, filename });
    return;
  }

  const blob = await gerarPdfBlob(lastResult, lastInputs, ROWS, { fmtEuro, fmtPct }, { nomeImovel, filename });
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Proposta ZFlip', text: 'Proposta de flip imobiliário — Zuri Real Estate' });
      return;
    } catch (err) { /* fallback abaixo */ }
  }

  if (kind === 'email') {
    const url = URL.createObjectURL(blob);
    window.location.href = `mailto:?subject=Proposta%20ZFlip&body=Segue%20proposta%20de%20flip%20imobiliário%20em%20anexo.`;
    window.open(url, '_blank');
  } else if (kind === 'whatsapp') {
    window.open('https://wa.me/?text=Proposta%20de%20flip%20imobili%C3%A1rio%20-%20Zuri%20Real%20Estate', '_blank');
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
