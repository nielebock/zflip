import { randomUUID } from 'node:crypto';
import { json, erro, lerJson } from './_lib/http.js';
import { sql } from './_lib/db.js';
import { calcularZFlip } from './_lib/motor.js';
import { construirTag } from './_lib/nome.js';

const MAX_FOTOS = 20;
const MAX_PRINCIPAIS = 4;
const MAX_DOCUMENTOS = 30;
const MAX_BYTES = 50 * 1024 * 1024;

const CAMPOS_PCT = [
  'comissao_venda_pct', 'iva_comissao_pct', 'roi_alvo_pct', 'custos_juridicos_pct',
  'escritura_registos_pct', 'imposto_selo_pct', 'outros_custos_pct', 'imi_anual_pct',
];

function numeroValido(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function validarInputs(i) {
  if (!i || typeof i !== 'object') return 'Dados do negócio ausentes';
  if (!numeroValido(i.preco_venda) || i.preco_venda <= 0) return 'Preço de venda inválido';
  if (i.preco_compra !== null && (!numeroValido(i.preco_compra) || i.preco_compra <= 0)) return 'Preço de compra inválido';
  if (typeof i.aplicar_imt !== 'boolean') return 'Campo Aplicar IMT inválido';
  if (!numeroValido(i.prazo_cpcv_dias) || !Number.isInteger(i.prazo_cpcv_dias)) return 'Prazo para CPCV inválido';
  if (!numeroValido(i.prazo_meses) || !Number.isInteger(i.prazo_meses)) return 'Prazo inválido';
  if (!['pct', 'fixo'].includes(i.modo_remodelacao)) return 'Modo de remodelação inválido';
  if (!numeroValido(i.remodelacao_valor)) return 'Valor de remodelação inválido';
  for (const c of CAMPOS_PCT) if (!numeroValido(i[c])) return `Campo ${c} inválido`;
  return null;
}

function validarArquivos(lista, max, rotulo) {
  if (!Array.isArray(lista)) return `Lista de ${rotulo} inválida`;
  if (lista.length > max) return `Máximo de ${max} ${rotulo}`;
  for (const a of lista) {
    if (!a || typeof a.nome !== 'string' || !a.nome) return `Nome de arquivo inválido em ${rotulo}`;
    if (typeof a.tamanho !== 'number' || a.tamanho > MAX_BYTES) return `O arquivo ${a.nome} passa de 50 MB`;
  }
  return null;
}

// principais: posições (em `fotos`) das até 4 fotos que entram grandes no relatório, na ordem escolhida.
function validarPrincipais(principais, totalFotos) {
  if (!Array.isArray(principais) || principais.length > MAX_PRINCIPAIS) return `Escolha no máximo ${MAX_PRINCIPAIS} fotos principais`;
  const vistos = new Set();
  for (const i of principais) {
    if (!Number.isInteger(i) || i < 0 || i >= totalFotos || vistos.has(i)) return 'Fotos principais inválidas';
    vistos.add(i);
  }
  return null;
}

// Nome seguro para o caminho no armazenamento, mantendo legível o nome original.
function nomeSeguro(nome) {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return (limpo || 'arquivo').slice(-120);
}

// Cria o registro do negócio e devolve os caminhos para o celular enviar os
// arquivos direto ao armazenamento (sem passar pelo limite de 4,5 MB da Vercel;
// ver api/blob-upload.js, que emite o token de upload para cada caminho).
export async function POST(request) {
  const body = await lerJson(request);
  if (!body) return erro('Corpo da requisição inválido');
  const { inputs, fotos = [], documentos = [], principais = [] } = body;
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  if (!nome || nome.length > 80) return erro('Informe o nome do imóvel ou projeto (até 80 caracteres)');

  const falha = validarInputs(inputs)
    || validarArquivos(fotos, MAX_FOTOS, 'fotos')
    || validarArquivos(documentos, MAX_DOCUMENTOS, 'documentos')
    || validarPrincipais(principais, fotos.length);
  if (falha) return erro(falha);

  const { conta1, conta2 } = calcularZFlip(inputs);
  const id = randomUUID();
  const caminhosFotos = fotos.map((f, n) => `${id}/fotos/${n + 1}-${nomeSeguro(f.nome)}`);
  const caminhosMiniaturas = fotos.map((f, n) => `${id}/miniaturas/${n + 1}-${nomeSeguro(f.nome)}`);
  const caminhosDocs = documentos.map((d, n) => `${id}/documentos/${n + 1}-${nomeSeguro(d.nome)}`);
  const caminhosPrincipais = principais.map(i => caminhosFotos[i]);

  const db = sql();
  let inserido;
  try {
    [inserido] = await db`
      insert into public.negocios (
        id, nome, preco_venda, preco_compra, aplicar_imt,
        comissao_venda_pct, iva_comissao_pct, roi_alvo_pct, prazo_cpcv_dias, prazo_meses,
        modo_remodelacao, remodelacao_valor_ou_pct, custos_juridicos_pct, escritura_registos_pct,
        imposto_selo_pct, outros_custos_pct, imi_anual_pct,
        resultado_conta_direta, resultado_conta_reversa,
        fotos, miniaturas, fotos_principais, documentos
      ) values (
        ${id}, ${nome}, ${inputs.preco_venda}, ${inputs.preco_compra}, ${inputs.aplicar_imt},
        ${inputs.comissao_venda_pct}, ${inputs.iva_comissao_pct}, ${inputs.roi_alvo_pct}, ${inputs.prazo_cpcv_dias}, ${inputs.prazo_meses},
        ${inputs.modo_remodelacao}, ${inputs.remodelacao_valor}, ${inputs.custos_juridicos_pct}, ${inputs.escritura_registos_pct},
        ${inputs.imposto_selo_pct}, ${inputs.outros_custos_pct}, ${inputs.imi_anual_pct},
        ${JSON.stringify(conta1)}, ${JSON.stringify(conta2)},
        ${caminhosFotos}, ${caminhosMiniaturas}, ${caminhosPrincipais}, ${caminhosDocs}
      )
      returning numero, criado_em
    `;
  } catch (e) {
    console.error('insert negocios', e);
    return erro('Não foi possível salvar o negócio', 500);
  }

  const tag = construirTag(inserido.numero, inserido.criado_em, nome);
  try {
    await db`update public.negocios set tag = ${tag} where id = ${id}`;
  } catch (e) {
    console.error('update tag', e); // não impede o negócio de seguir salvo
  }

  return json({
    id,
    tag,
    uploads: { fotos: caminhosFotos, miniaturas: caminhosMiniaturas, documentos: caminhosDocs },
    resultado: { conta1, conta2 },
  });
}
