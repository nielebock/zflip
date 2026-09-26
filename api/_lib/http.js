export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function erro(mensagem, status = 400) {
  return json({ erro: mensagem }, status);
}

export async function lerJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function idValido(id) {
  return typeof id === 'string' && UUID.test(id);
}
