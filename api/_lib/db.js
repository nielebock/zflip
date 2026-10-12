import { neon } from '@neondatabase/serverless';

// Cliente SQL do Neon, usado somente dentro das Vercel Functions.
// DATABASE_URL é a connection string do projeto Neon (nunca no navegador).
let sqlClient = null;

export function sql() {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Variável DATABASE_URL não configurada');
    sqlClient = neon(url);
  }
  return sqlClient;
}
