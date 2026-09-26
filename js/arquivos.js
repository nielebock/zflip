// Seleção de fotos (até 4, redimensionadas no celular) e documentos do negócio.

const MAX_FOTOS = 4;
const LADO_MAX_FOTO = 1600;

const arquivos = { fotos: [], documentos: [] };
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

function renderFotos() {
  const n = arquivos.fotos.length;
  fotosContagem.textContent = n === 0 ? 'Nenhuma foto adicionada'
    : n >= MAX_FOTOS ? `${n} de ${MAX_FOTOS} fotos adicionadas (limite atingido)`
    : `${n} de ${MAX_FOTOS} fotos adicionadas`;
  fotosContagem.classList.toggle('tem', n > 0);
  fotosPreview.innerHTML = '';
  arquivos.fotos.forEach((file, i) => {
    const box = document.createElement('div');
    box.className = 'thumb';
    const img = document.createElement('img');
    img.alt = file.name;
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    box.appendChild(img);
    box.appendChild(botaoRemover(`Remover foto ${file.name}`, () => {
      arquivos.fotos.splice(i, 1);
      renderFotos();
      aoMudarArquivos();
    }));
    fotosPreview.appendChild(box);
  });
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
    li.appendChild(botaoRemover(`Remover documento ${file.name}`, () => {
      arquivos.documentos.splice(i, 1);
      renderDocumentos();
      aoMudarArquivos();
    }));
    docsLista.appendChild(li);
  });
}

fotosInput.addEventListener('change', () => {
  const novas = Array.from(fotosInput.files).filter(f => f.type.startsWith('image/'));
  arquivos.fotos = arquivos.fotos.concat(novas).slice(0, MAX_FOTOS);
  fotosInput.value = '';
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
// passam de 5 MB, e o PDF final embute as quatro fotos.
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
