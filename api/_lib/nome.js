// Tag da proposta: 0001_Zuri_20260928_T2Alvalade. numero vem da sequência do banco
// (negocios_numero_seq), criadoEm é o timestamp de criação (criado_em), ambos devolvidos pelo insert.
export function construirTag(numero, criadoEm, nome) {
  const aaaammdd = new Date(criadoEm).toISOString().slice(0, 10).replace(/-/g, '');
  const base = String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '');
  return `${String(numero).padStart(4, '0')}_Zuri_${aaaammdd}_${base}`;
}

// Nome do arquivo a partir da tag da proposta.
// Negócios sem tag (gravados antes da migração 004) caem no nome antigo, a partir do nome do imóvel.
export function nomeDeArquivo(negocio) {
  if (negocio.tag) return negocio.tag;
  const base = String(negocio.nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
  return `proposta-${base || negocio.id.slice(0, 8)}`;
}
