// Fluxo de exportação: salva o negócio, envia os arquivos, gera o PDF no servidor
// e reaproveita o mesmo PDF para download, e-mail e WhatsApp.

let supabaseCliente = null;
let negocioAtual = null; // { id, urlPdf }, descartado quando os dados mudam

function invalidarNegocio() {
  negocioAtual = null;
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

async function obterSupabase() {
  if (supabaseCliente) return supabaseCliente;
  const cfg = await (await fetch('/api/config')).json();
  supabaseCliente = window.supabase.createClient(cfg.supabaseUrl, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseCliente;
}

async function enviarArquivos(sb, lista, itens, definirStatus, rotulo) {
  for (let i = 0; i < lista.length; i++) {
    definirStatus(`Enviando ${rotulo} ${i + 1} de ${lista.length}...`);
    const { error } = await sb.storage.from('documentos-negocios')
      .uploadToSignedUrl(lista[i].caminho, lista[i].token, itens[i], {
        contentType: itens[i].type || 'application/octet-stream',
      });
    if (error) throw new Error(`Falha ao enviar ${itens[i].name}`);
  }
}

// Garante que existe um negócio salvo e um PDF gerado para os dados atuais.
async function garantirPdf(inputs, definirStatus) {
  if (negocioAtual) return negocioAtual;

  definirStatus('Preparando arquivos...');
  const fotos = [];
  for (const f of arquivos.fotos) fotos.push(await reduzirFoto(f));
  const docs = arquivos.documentos;

  const meta = a => a.map(f => ({ nome: f.name, tamanho: f.size }));
  const criado = await chamarApi('/api/negocio', { inputs, fotos: meta(fotos), documentos: meta(docs) });

  if (fotos.length || docs.length) {
    const sb = await obterSupabase();
    await enviarArquivos(sb, criado.uploads.fotos, fotos, definirStatus, 'foto');
    await enviarArquivos(sb, criado.uploads.documentos, docs, definirStatus, 'documento');
  }

  definirStatus('Gerando a folha de proposta...');
  const pdf = await chamarApi('/api/pdf', { id: criado.id });
  negocioAtual = { id: criado.id, urlPdf: pdf.url };
  return negocioAtual;
}

async function baixarPdf(negocio) {
  const resp = await fetch(negocio.urlPdf);
  if (!resp.ok) throw new Error('Não foi possível baixar o PDF gerado');
  return new File([await resp.blob()], `proposta-zflip-${negocio.id.slice(0, 8)}.pdf`, { type: 'application/pdf' });
}

async function acaoGerarPdf(inputs, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  window.open(negocio.urlPdf, '_blank');
  definirStatus('PDF gerado. Se não abriu, permita pop-ups neste site.', 'ok');
}

async function acaoEnviarEmail(inputs, para, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  definirStatus('Enviando e-mail...');
  await chamarApi('/api/email', { id: negocio.id, para });
  definirStatus(`E-mail enviado para ${para}.`, 'ok');
}

async function acaoEnviarWhatsApp(inputs, definirStatus) {
  const negocio = await garantirPdf(inputs, definirStatus);
  const arquivo = await baixarPdf(negocio);
  if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Proposta ZFlip' });
      definirStatus('Proposta compartilhada.', 'ok');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') { definirStatus(''); return; }
      // outro erro (por exemplo, gesto do usuário expirado): segue para o link
    }
  }
  const texto = `Proposta de flip imobiliário, Zuri Real Estate: ${negocio.urlPdf}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  definirStatus('WhatsApp aberto com o link do PDF.', 'ok');
}
