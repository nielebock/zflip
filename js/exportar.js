// Fluxo de exportação: salva o negócio, envia os arquivos, gera o PDF no servidor
// e reaproveita o mesmo PDF para download, e-mail e WhatsApp.
// Nada vai ao servidor antes de o usuário gerar ou enviar o relatório.

let negocioAtual = null; // { id, nome, urlPdf }, descartado quando os dados mudam
let ultimoNome = '';

function invalidarNegocio() {
  negocioAtual = null;
}

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
async function enviarArquivos(lista, itens, definirStatus, rotulo) {
  for (let i = 0; i < lista.length; i++) {
    definirStatus(`Enviando ${rotulo} ${i + 1} de ${lista.length}...`);
    const corpo = new FormData();
    corpo.append('cacheControl', '3600');
    corpo.append('', itens[i]);
    let resp;
    try {
      resp = await fetch(lista[i].url, { method: 'PUT', body: corpo });
    } catch {
      throw new Error(`Sem conexão ao enviar ${itens[i].name}. Tente de novo.`);
    }
    if (!resp.ok) throw new Error(`Falha ao enviar ${itens[i].name}`);
  }
}

// Garante que existe um negócio salvo e um PDF gerado para os dados atuais.
// Devolve null se o usuário cancelar a janela do nome.
async function garantirPdf(inputs, definirStatus) {
  if (negocioAtual) return negocioAtual;

  const nome = await pedirNome();
  if (!nome) return null;
  ultimoNome = nome;

  definirStatus('Preparando arquivos...');
  const fotos = [];
  for (const f of arquivos.fotos) fotos.push(await reduzirFoto(f));
  const docs = arquivos.documentos;

  const meta = a => a.map(f => ({ nome: f.name, tamanho: f.size }));
  const criado = await chamarApi('/api/negocio', { nome, inputs, fotos: meta(fotos), documentos: meta(docs) });

  await enviarArquivos(criado.uploads.fotos, fotos, definirStatus, 'foto');
  await enviarArquivos(criado.uploads.documentos, docs, definirStatus, 'documento');

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
  window.open(negocio.urlPdf, '_blank');
  definirStatus(`PDF de "${negocio.nome}" gerado. Se não abriu, permita pop-ups neste site.`, 'ok');
}

async function acaoEnviarEmail(inputs, para, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  if (!negocio) return definirStatus('');
  definirStatus('Enviando e-mail...');
  await chamarApi('/api/email', { id: negocio.id, para });
  definirStatus(`E-mail com "${negocio.nome}" enviado para ${para}.`, 'ok');
}

async function acaoEnviarWhatsApp(inputs, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  if (!negocio) return definirStatus('');
  const arquivo = await baixarPdf(negocio);
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: negocio.nome });
      definirStatus('Proposta compartilhada.', 'ok');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') { definirStatus(''); return; }
      // outro erro (por exemplo, gesto do usuário expirado): segue para o link
    }
  }
  const texto = `Proposta de flip imobiliário, ${negocio.nome}: ${negocio.urlPdf}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  definirStatus('WhatsApp aberto com o link do PDF.', 'ok');
}
