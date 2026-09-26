// Fotos (até 20 no aparelho, 4 principais no relatório) e documentos do negócio.
// Só as fotos principais são reduzidas e enviadas ao servidor.

const MAX_FOTOS_ADICIONADAS = 20;
const MAX_PRINCIPAIS = 4;
const LADO_MINIATURA = 240;
// Formatos que entram no PDF como páginas; os demais ficam só listados na página 1.
const EXT_NO_PDF = ['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'md'];
const LADO_MAX_FOTO = 1600;

// fotos: [{ file, miniatura }] todas as adicionadas; principais: as escolhidas para o relatório, em ordem.
const arquivos = { fotos: [], principais: [], documentos: [] };
let avisoFotos = '';
let aoMudarArquivos = () => {};

const fotosInput = document.getElementById('fotos');
const fotosPreview = document.getElementById('fotos-preview');
const docsInput = document.getElementById('documentos');
const docsLista = document.getElementById('documentos-lista');
const fotosContagem = document.getElementById('fotos-contagem');
const docsContagem = document.getElementById('documentos-contagem');

function botaoRemover(rotulo, aoClicar) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'remover';
  b.textContent = '×';
  b.setAttribute('aria-label', rotulo);
  b.addEventListener('click', aoClicar);
  return b;
}

function textoContagemFotos() {
  const n = arquivos.fotos.length;
  const k = arquivos.principais.length;
  if (n === 0) return 'Nenhuma foto adicionada';
  const total = n === 1 ? '1 foto adicionada' : `${n} fotos adicionadas`;
  return `${total}, ${k} de ${MAX_PRINCIPAIS} principais no relatório`;
}

function alternarPrincipal(item) {
  const pos = arquivos.principais.indexOf(item);
  if (pos >= 0) {
    arquivos.principais.splice(pos, 1);
    avisoFotos = '';
  } else if (arquivos.principais.length < MAX_PRINCIPAIS) {
    arquivos.principais.push(item);
    avisoFotos = '';
  } else {
    avisoFotos = `Já há ${MAX_PRINCIPAIS} fotos principais. Toque em uma selecionada para desmarcar antes de escolher outra.`;
  }
  renderFotos();
  aoMudarArquivos();
}

function removerFoto(item) {
  arquivos.fotos.splice(arquivos.fotos.indexOf(item), 1);
  const pos = arquivos.principais.indexOf(item);
  if (pos >= 0) arquivos.principais.splice(pos, 1);
  URL.revokeObjectURL(item.miniatura);
  avisoFotos = '';
  renderFotos();
  aoMudarArquivos();
}

function renderFotos() {
  fotosContagem.textContent = avisoFotos || textoContagemFotos();
  fotosContagem.classList.toggle('tem', arquivos.fotos.length > 0 && !avisoFotos);
  fotosContagem.classList.toggle('alerta', !!avisoFotos);
  fotosPreview.innerHTML = '';
  arquivos.fotos.forEach(item => {
    const ordem = arquivos.principais.indexOf(item) + 1; // 0 quando não é principal
    const box = document.createElement('div');
    box.className = 'thumb' + (ordem ? ' sel' : '');
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-pressed', ordem ? 'true' : 'false');
    box.setAttribute('aria-label', ordem ? `Foto principal ${ordem}: ${item.file.name}` : `Marcar como principal: ${item.file.name}`);
    box.addEventListener('click', () => alternarPrincipal(item));
    box.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternarPrincipal(item); }
    });
    const img = document.createElement('img');
    img.alt = '';
    img.src = item.miniatura;
    box.appendChild(img);
    if (ordem) {
      const marca = document.createElement('span');
      marca.className = 'ordem';
      marca.textContent = ordem;
      box.appendChild(marca);
    }
    const x = botaoRemover(`Remover foto ${item.file.name}`, e => { e.stopPropagation(); removerFoto(item); });
    box.appendChild(x);
    fotosPreview.appendChild(box);
  });
}

// Miniatura pequena para a grade: com até 20 fotos de 12 MP, decodificar as originais pesaria demais no celular.
async function criarMiniatura(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MINIATURA / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * escala));
    canvas.height = Math.max(1, Math.round(bmp.height * escala));
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.7));
    if (blob) return URL.createObjectURL(blob);
  } catch { /* usa o arquivo original abaixo */ }
  return URL.createObjectURL(file);
}

function renderDocumentos() {
  const n = arquivos.documentos.length;
  docsContagem.textContent = n === 0 ? 'Nenhum documento adicionado'
    : n === 1 ? '1 documento adicionado' : `${n} documentos adicionados`;
  docsContagem.classList.toggle('tem', n > 0);
  docsLista.innerHTML = '';
  arquivos.documentos.forEach((file, i) => {
    const li = document.createElement('li');
    const nome = document.createElement('span');
    nome.className = 'nome';
    nome.textContent = file.name;
    li.appendChild(nome);
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    const aviso = document.createElement('span');
    aviso.className = 'aviso ' + (EXT_NO_PDF.includes(ext) ? 'entra' : 'so-lista');
    aviso.textContent = EXT_NO_PDF.includes(ext) ? 'entra no PDF' : 'só listado';
    li.appendChild(aviso);
    li.appendChild(botaoRemover(`Remover documento ${file.name}`, () => {
      arquivos.documentos.splice(i, 1);
      renderDocumentos();
      aoMudarArquivos();
    }));
    docsLista.appendChild(li);
  });
}

fotosInput.addEventListener('change', async () => {
  const escolhidas = Array.from(fotosInput.files).filter(f => f.type.startsWith('image/'));
  fotosInput.value = '';
  const vagas = MAX_FOTOS_ADICIONADAS - arquivos.fotos.length;
  const novas = escolhidas.slice(0, Math.max(0, vagas));
  avisoFotos = escolhidas.length > novas.length
    ? `Limite de ${MAX_FOTOS_ADICIONADAS} fotos. ${escolhidas.length - novas.length} não foram adicionadas.` : '';
  const itens = await Promise.all(novas.map(async file => ({ file, miniatura: await criarMiniatura(file) })));
  for (const item of itens) {
    arquivos.fotos.push(item);
    if (arquivos.principais.length < MAX_PRINCIPAIS) arquivos.principais.push(item); // as primeiras já entram como principais
  }
  renderFotos();
  aoMudarArquivos();
});

docsInput.addEventListener('change', () => {
  arquivos.documentos = arquivos.documentos.concat(Array.from(docsInput.files));
  docsInput.value = '';
  renderDocumentos();
  aoMudarArquivos();
});

// Reduz a foto para no máximo 1600 px no maior lado, em JPEG. Fotos de celular
// passam de 5 MB, e o PDF final embute as fotos principais.
async function reduzirFoto(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const escala = Math.min(1, LADO_MAX_FOTO / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return file;
    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
