function construirDocPdf(result, inputs, rows, fmt, meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { conta1, conta2 } = result;
  const nomeImovel = (meta && meta.nomeImovel) || '';

  const margin = 40;
  let y = margin;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('ZFlip — Proposta de Flip Imobiliário', margin, 40);
  doc.setFontSize(11);
  doc.text('Zuri Real Estate', margin, 58);

  y = 100;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  const now = new Date();
  const dataStr = now.toLocaleDateString('pt-PT');
  const horaStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  if (nomeImovel) {
    doc.setFont(undefined, 'bold');
    doc.text(`Imóvel: ${nomeImovel}`, margin, y);
    doc.setFont(undefined, 'normal');
    y += 16;
  }
  doc.text(`Data: ${dataStr} ${horaStr}`, margin, y);
  y += 25;

  const colX = [margin, 440, 555];
  const rightEdge = 555;

  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, rightEdge - margin, 20, 'F');
  doc.setFont(undefined, 'bold');
  doc.text('Indicador', colX[0] + 4, y + 14);
  doc.text('Preço máximo', colX[1], y + 14, { align: 'right' });
  doc.text('Preço informado', colX[2], y + 14, { align: 'right' });
  doc.setFont(undefined, 'normal');
  y += 20;

  rows.forEach((row, i) => {
    const rowH = 16;
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, rightEdge - margin, rowH, 'F');
    }
    doc.setFontSize(9);
    doc.text(row.label, colX[0] + 4, y + 11);

    const vMaximo = (row.isento && !inputs.aplicar_imt) ? 'Isento' : row.fmt(conta2[row.key]);
    let vInformado;
    if (!conta1) {
      vInformado = '—';
    } else {
      vInformado = (row.isento && !inputs.aplicar_imt) ? 'Isento' : row.fmt(conta1[row.key]);
    }
    doc.text(String(vMaximo), colX[1], y + 11, { align: 'right' });
    doc.text(String(vInformado), colX[2], y + 11, { align: 'right' });
    y += rowH;
  });

  y += 20;
  doc.setFontSize(10);
  if (!conta1) {
    doc.setTextColor(15, 23, 42);
    doc.text(`Preço máximo de compra para o ROI alvo: ${fmt.fmtEuro(conta2.preco_compra)}`, margin, y, { maxWidth: 555 - margin * 2 });
  } else {
    const diff = conta2.preco_compra - conta1.preco_compra;
    const diffPct = conta2.preco_compra !== 0 ? diff / conta2.preco_compra : 0;
    const abaixo = diff >= 0;
    doc.setTextColor(abaixo ? 22 : 185, abaixo ? 163 : 28, abaixo ? 74 : 28);
    const txt = abaixo
      ? `Preço informado está ${fmt.fmtEuro(Math.abs(diff))} (${fmt.fmtPct(Math.abs(diffPct))}) abaixo do máximo — margem de segurança.`
      : `Preço informado está ${fmt.fmtEuro(Math.abs(diff))} (${fmt.fmtPct(Math.abs(diffPct))}) acima do máximo para o ROI alvo.`;
    doc.text(txt, margin, y, { maxWidth: 555 - margin * 2 });
  }

  return doc;
}

function gerarPdfProposta(result, inputs, rows, fmt, meta) {
  const doc = construirDocPdf(result, inputs, rows, fmt, meta);
  doc.save((meta && meta.filename) || 'proposta-zflip.pdf');
}

async function gerarPdfBlob(result, inputs, rows, fmt, meta) {
  const doc = construirDocPdf(result, inputs, rows, fmt, meta);
  return doc.output('blob');
}
