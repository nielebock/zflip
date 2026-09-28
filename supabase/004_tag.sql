-- Numeração sequencial e tag automática da proposta, para localizar depois no
-- Supabase (Table Editor, Storage) e nos arquivos gerados.
-- Formato da tag: 0001_Zuri_AAAAMMDD_NomeInseridoNoApp

create sequence if not exists public.negocios_numero_seq;

alter table public.negocios
  add column numero integer not null default nextval('public.negocios_numero_seq');

alter sequence public.negocios_numero_seq owned by public.negocios.numero;

alter table public.negocios
  add column tag text generated always as (
    lpad(numero::text, 4, '0') || '_Zuri_' || to_char(criado_em, 'YYYYMMDD') || '_' ||
    regexp_replace(regexp_replace(trim(nome), '[[:space:]]+', '_', 'g'), '[^A-Za-z0-9_]', '', 'g')
  ) stored;
