// Tabela de IMT 2026 — Tabela III, Continente, Habitação não HPP
const IMT_TABLE_2026 = [
  { escalao: 1, min: 0,          max: 106346,   taxa: 0.01,   abater: 0 },
  { escalao: 2, min: 106346,     max: 145470,   taxa: 0.02,   abater: 1063.46 },
  { escalao: 3, min: 145470,     max: 198347,   taxa: 0.05,   abater: 5427.56 },
  { escalao: 4, min: 198347,     max: 330539,   taxa: 0.07,   abater: 9394.50 },
  { escalao: 5, min: 330539,     max: 633931,   taxa: 0.08,   abater: 12699.89 },
  { escalao: 6, min: 633931,     max: 1150853,  taxa: 0.06,   abater: 0 },
  { escalao: 7, min: 1150853,    max: Infinity, taxa: 0.075,  abater: 0 },
];

function findImtEscalao(preco) {
  return IMT_TABLE_2026.find(e => preco >= e.min && preco <= e.max) || IMT_TABLE_2026[IMT_TABLE_2026.length - 1];
}

function calcularImt(preco, aplicarImt) {
  if (!aplicarImt) return 0;
  const e = findImtEscalao(preco);
  return preco * e.taxa - e.abater;
}
