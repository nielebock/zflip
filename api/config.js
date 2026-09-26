import { json } from './_lib/http.js';

// Somente valores públicos: URL do projeto e Publishable key.
export function GET() {
  return json({
    supabaseUrl: process.env.SUPABASE_URL,
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
}
