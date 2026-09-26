// Nome do arquivo a partir do nome do imóvel: "T2 Alvalade" vira "proposta-t2-alvalade".
export function nomeDeArquivo(negocio) {
  const base = String(negocio.nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 60);
  return `proposta-${base || negocio.id.slice(0, 8)}`;
}
