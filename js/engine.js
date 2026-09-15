// Motor de cálculo ZFlip — ver spec (Conta 1 Direta / Conta 2 Reversa)

function calcularTermosAuxiliares(inputs) {
  const {
    custos_juridicos_pct, escritura_registos_pct, imposto_selo_pct,
    outros_custos_pct, imi_anual_pct, prazo_meses,
    modo_remodelacao, remodelacao_valor,
    preco_venda, comissao_venda_pct, iva_comissao_pct,
  } = inputs;

  let k = custos_juridicos_pct + escritura_registos_pct + imposto_selo_pct
    + outros_custos_pct + (imi_anual_pct * prazo_meses / 12);

  let remFixo = 0;
  if (modo_remodelacao === 'fixo') {
    remFixo = remodelacao_valor;
  } else {
    k += remodelacao_valor; // remodelacao_pct entra em k
  }

  const comissaoVendaComIva = preco_venda * comissao_venda_pct * (1 + iva_comissao_pct);
  const receitaLiquidaVenda = preco_venda - comissaoVendaComIva;

  return { k, remFixo, comissaoVendaComIva, receitaLiquidaVenda };
}

// Conta 1 — Direta
function calcularConta1(inputs, precoCompra, aux) {
  const {
    aplicar_imt, custos_juridicos_pct, escritura_registos_pct,
    imposto_selo_pct, outros_custos_pct, imi_anual_pct, prazo_meses,
    modo_remodelacao, remodelacao_valor,
  } = inputs;
  const { remFixo, receitaLiquidaVenda, comissaoVendaComIva } = aux;

  const imt = calcularImt(precoCompra, aplicar_imt);

  const remodelacao = modo_remodelacao === 'fixo'
    ? remFixo
    : remodelacao_valor * precoCompra;

  const custosJuridicos = custos_juridicos_pct * precoCompra;

  const totalOutrosCustos =
    (escritura_registos_pct + imposto_selo_pct + outros_custos_pct) * precoCompra
    + (imi_anual_pct * precoCompra * prazo_meses / 12);

  const capitalTotalInvestido = precoCompra + remodelacao + custosJuridicos + totalOutrosCustos + imt;
  const lucroLiquidoReal = receitaLiquidaVenda - capitalTotalInvestido;
  const roiReal = capitalTotalInvestido !== 0 ? lucroLiquidoReal / capitalTotalInvestido : 0;
  const compraVendaPct = inputs.preco_venda !== 0 ? precoCompra / inputs.preco_venda : 0;

  return {
    preco_venda: inputs.preco_venda,
    preco_compra: precoCompra,
    remodelacao,
    custos_juridicos: custosJuridicos,
    total_outros_custos: totalOutrosCustos,
    imt,
    comissao_venda_com_iva: comissaoVendaComIva,
    capital_total_investido: capitalTotalInvestido,
    lucro_liquido: lucroLiquidoReal,
    receita_liquida_venda: receitaLiquidaVenda,
    roi: roiReal,
    compra_venda_pct: compraVendaPct,
  };
}

// Conta 2 — Reversa
function calcularPrecoMaximoCompra(inputs, aux) {
  const { aplicar_imt, roi_alvo_pct } = inputs;
  const { k, remFixo, receitaLiquidaVenda } = aux;

  const alvo = receitaLiquidaVenda / (1 + roi_alvo_pct);

  if (!aplicar_imt) {
    return (alvo - remFixo) / (1 + k);
  }

  for (const e of IMT_TABLE_2026) {
    const candidato = (alvo - remFixo + e.abater) / (1 + k + e.taxa);
    if (candidato >= e.min && candidato <= e.max) {
      return candidato;
    }
  }
  // fallback: nenhum escalão aceitou (não deve acontecer com tabela contínua)
  return (alvo - remFixo) / (1 + k);
}

function calcularZFlip(inputs) {
  const aux = calcularTermosAuxiliares(inputs);

  const conta1 = inputs.preco_compra != null
    ? calcularConta1(inputs, inputs.preco_compra, aux)
    : null;

  const precoMaximo = calcularPrecoMaximoCompra(inputs, aux);
  const conta2 = calcularConta1(inputs, precoMaximo, aux);

  return { conta1, conta2 };
}
