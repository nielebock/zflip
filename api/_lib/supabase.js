import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'documentos-negocios';

let client = null;

// Cliente com a Secret key, usado somente dentro das Vercel Functions.
export function supabaseAdmin() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Variáveis SUPABASE_URL e SUPABASE_SECRET_KEY não configuradas');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
