// Fluxo de exportação: salva o negócio, envia os arquivos, gera o PDF no servidor
// e reaproveita o mesmo PDF para download, e-mail e WhatsApp.
// Nada vai ao servidor antes de o usuário gerar ou enviar o relatório.

let negocioAtual = null; // { id, nome, urlPdf }, descartado quando os dados mudam
let ultimoNome = '';

const painelPronto = document.getElementById('pronto');
const linkPdf = document.getElementById('link-pdf');

function invalidarNegocio() {
  negocioAtual = null;
  painelPronto.hidden = true;
}

// Depois de esperar o servidor, o navegador do celular já não considera o toque
// original e bloqueia window.open. Por isso o PDF pronto é aberto por um link
// que o usuário toca, e o arquivo é baixado antes para o compartilhamento ser imediato.
function mostrarPronto(negocio) {
  linkPdf.href = negocio.urlPdf;
  painelPronto.hidden = false;
  if (!negocio.arquivo && !negocio.baixando) {
    negocio.baixando = true;
    baixarPdf(negocio).then(f => { negocio.arquivo = f; }).catch(() => {}).finally(() => { negocio.baixando = false; });
  }
}

async function compartilharPdf() {
  const negocio = negocioAtual;
  if (!negocio) return;
  const arquivo = negocio.arquivo;
  if (arquivo && navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: negocio.nome });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      // outro erro: segue para o link do WhatsApp
    }
  }
  const texto = `Proposta de flip imobiliário, ${negocio.nome}: ${negocio.urlPdf}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

document.getElementById('btn-compartilhar').addEventListener('click', compartilharPdf);

function nomeDeArquivo(nome) {
  const base = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `proposta-${base || 'zflip'}`;
}

// Abre a janela para nomear o imóvel. Devolve o nome, ou null se o usuário cancelar.
function pedirNome() {
  const dlg = document.getElementById('dlg-nome');
  const campo = document.getElementById('nome_imovel');
  const form = document.getElementById('form-nome');
  const cancelar = document.getElementById('nome-cancelar');
  return new Promise(resolve => {
    let resultado = null;
    const aoEnviar = () => { resultado = campo.value.trim() || null; };
    const aoCancelar = () => dlg.close();
    const aoFechar = () => {
      form.removeEventListener('submit', aoEnviar);
      cancelar.removeEventListener('click', aoCancelar);
      dlg.removeEventListener('close', aoFechar);
      resolve(resultado);
    };
    campo.value = ultimoNome;
    form.addEventListener('submit', aoEnviar);
    cancelar.addEventListener('click', aoCancelar);
    dlg.addEventListener('close', aoFechar);
    dlg.showModal();
    campo.focus();
    campo.select();
  });
}

async function chamarApi(caminho, corpo) {
  let resp;
  try {
    resp = await fetch(caminho, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro inesperado no servidor');
  return dados;
}

// Envia direto ao Storage pela URL assinada, sem passar pelo limite de 4,5 MB da Vercel.
async function enviarUm(url, arquivo) {
  const corpo = new FormData();
  corpo.append('cacheControl', '3600');
  corpo.append('', arquivo);
  let resp;
  try {
    resp = await fetch(url, { method: 'PUT', body: corpo });
  } catch {
    throw new Error(`Sem conexão ao enviar ${arquivo.name}. Tente de novo.`);
  }
  if (!resp.ok) throw new Error(`Falha ao enviar ${arquivo.name}`);
}

// Envia vários arquivos, quatro de cada vez, mostrando o progresso.
async function enviarTodos(tarefas, definirStatus) {
  let proximo = 0;
  let feitos = 0;
  let falhou = false;
  const trabalhador = async () => {
    while (!falhou && proximo < tarefas.length) {
      const tarefa = tarefas[proximo++];
      try {
        await enviarUm(tarefa.url, tarefa.arquivo);
      } catch (e) {
        falhou = true;
        throw e;
      }
      feitos++;
      definirStatus(`Enviando arquivos ${feitos} de ${tarefas.length}...`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, tarefas.length) }, trabalhador));
}

// Garante que existe um negócio salvo e um PDF gerado para os dados atuais.
// Devolve null se o usuário cancelar a janela do nome.
async function garantirPdf(inputs, definirStatus) {
  if (negocioAtual) return negocioAtual;

  const nome = await pedirNome();
  if (!nome) return null;
  ultimoNome = nome;

  // Todas as fotos vão para o banco: reduzidas (1600 px) e com miniatura. As principais
  // (até 4) são indicadas por posição e entram grandes no relatório.
  const fotos = [];
  const miniaturas = [];
  for (let i = 0; i < arquivos.fotos.length; i++) {
    definirStatus(`Preparando foto ${i + 1} de ${arquivos.fotos.length}...`);
    const item = arquivos.fotos[i];
    const reduzida = await reduzirFoto(item.file);
    fotos.push(reduzida);
    miniaturas.push(new File([item.miniaturaBlob], reduzida.name, { type: item.miniaturaBlob.type || 'image/jpeg' }));
  }
  const principais = arquivos.principais.map(item => arquivos.fotos.indexOf(item));
  const docs = arquivos.documentos;

  definirStatus('Salvando o negócio...');
  const meta = a => a.map(f => ({ nome: f.name, tamanho: f.size }));
  const criado = await chamarApi('/api/negocio', { nome, inputs, fotos: meta(fotos), principais, documentos: meta(docs) });

  const tarefas = [];
  const juntar = (lista, arquivosDaLista) => lista.forEach((u, i) => tarefas.push({ url: u.url, arquivo: arquivosDaLista[i] }));
  juntar(criado.uploads.fotos, fotos);
  juntar(criado.uploads.miniaturas, miniaturas);
  juntar(criado.uploads.documentos, docs);
  if (tarefas.length) await enviarTodos(tarefas, definirStatus);

  definirStatus('Gerando a folha de proposta...');
  const pdf = await chamarApi('/api/pdf', { id: criado.id });
  negocioAtual = { id: criado.id, nome, urlPdf: pdf.url };
  return negocioAtual;
}

async function baixarPdf(negocio) {
  const resp = await fetch(negocio.urlPdf);
  if (!resp.ok) throw new Error('Não foi possível baixar o PDF gerado');
  return new File([await resp.blob()], `${nomeDeArquivo(negocio.nome)}.pdf`, { type: 'application/pdf' });
}

async function acaoGerarPdf(inputs, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  if (!negocio) return definirStatus('');
  mostrarPronto(negocio);
  definirStatus(`PDF de "${negocio.nome}" pronto. Toque em Abrir PDF.`, 'ok');
}

async function acaoEnviarEmail(inputs, para, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  if (!negocio) return definirStatus('');
  mostrarPronto(negocio);
  definirStatus('Enviando e-mail...');
  await chamarApi('/api/email', { id: negocio.id, para });
  definirStatus(`E-mail com "${negocio.nome}" enviado para ${para}.`, 'ok');
}

async function acaoEnviarWhatsApp(inputs, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  if (!negocio) return definirStatus('');
  definirStatus('Preparando o arquivo...');
  if (!negocio.arquivo) negocio.arquivo = await baixarPdf(negocio);
  mostrarPronto(negocio);
  definirStatus(`PDF de "${negocio.nome}" pronto. Toque em Compartilhar PDF para enviar pelo WhatsApp.`, 'ok');
}
