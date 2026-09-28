// Nome do arquivo a partir da tag da proposta (0001_Zuri_20260928_T2Alvalade).
// Negócios sem tag (gravados antes da migração 004) caem no nome antigo, a partir do nome do imóvel.
export function nomeDeArquivo(negocio) {
  if (negocio.tag) return negocio.tag;
  const base = String(negocio.nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
  return `proposta-${base || negocio.id.slice(0, 8)}`;
}
