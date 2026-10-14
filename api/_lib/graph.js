// Cliente mínimo do Microsoft Graph para gravar os arquivos das propostas no
// SharePoint. Autenticação app-only (client credentials), permissão Sites.Selected
// concedida apenas no site "ZURI-FINANCEIRO" (ver neon/LEIA-ME.md).
const HOSTNAME = 'arjonholding.sharepoint.com';
const SITE_PATH = '/sites/ZURI-FINANCEIRO';
// Pasta raiz dentro da biblioteca "Documentos Compartilhados" desse site.
export const PASTA_RAIZ = 'ZURI - Novos Investimentos/ZURI - Propostas';

let tokenCache = null; // { valor, expiraEm }
let driveIdCache = null;

async function obterToken() {
  if (tokenCache && tokenCache.expiraEm > Date.now() + 60_000) return tokenCache.valor;

  const tenantId = process.env.SHAREPOINT_TENANT_ID;
  const clientId = process.env.SHAREPOINT_CLIENT_ID;
  const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Variáveis SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID ou SHAREPOINT_CLIENT_SECRET não configuradas');
  }

  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const dados = await resp.json();
  if (!resp.ok) throw new Error(`Falha ao autenticar no Microsoft Graph: ${resp.status} ${dados.error} ${dados.error_description}`);
  tokenCache = { valor: dados.access_token, expiraEm: Date.now() + dados.expires_in * 1000 };
  return tokenCache.valor;
}

async function obterDriveId() {
  if (driveIdCache) return driveIdCache;
  const token = await obterToken();
  const respSite = await fetch(`https://graph.microsoft.com/v1.0/sites/${HOSTNAME}:${SITE_PATH}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respSite.ok) throw new Error(`Falha ao localizar o site do SharePoint: ${respSite.status}`);
  const site = await respSite.json();

  const respDrive = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respDrive.ok) throw new Error(`Falha ao localizar a biblioteca de documentos: ${respDrive.status}`);
  const drive = await respDrive.json();
  driveIdCache = drive.id;
  return driveIdCache;
}

function caminhoCompleto(caminho) {
  return `${PASTA_RAIZ}/${caminho}`.split('/').map(encodeURIComponent).join('/');
}

// Graph cria as pastas intermediárias automaticamente ao enviar o conteúdo.
export async function enviarArquivo(caminho, bytes, contentType) {
  const token = await obterToken();
  const driveId = await obterDriveId();
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${caminhoCompleto(caminho)}:/content`,
    { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType || 'application/octet-stream' }, body: bytes }
  );
  if (!resp.ok) throw new Error(`Falha ao enviar arquivo ao SharePoint: ${resp.status}`);
  const item = await resp.json();
  return item.webUrl;
}

export async function baixarArquivo(caminho) {
  const token = await obterToken();
  const driveId = await obterDriveId();
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${caminhoCompleto(caminho)}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  return Buffer.from(await resp.arrayBuffer());
}

export async function apagarArquivoGraph(caminho) {
  const token = await obterToken();
  const driveId = await obterDriveId();
  await fetch(`https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${caminhoCompleto(caminho)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}
