-- Numeração sequencial e tag da proposta, para localizar depois no Supabase
-- (Table Editor, Storage) e nos arquivos gerados.
-- Formato da tag: 0001_Zuri_AAAAMMDD_NomeInseridoNoApp
--
-- "numero" é preenchido sozinho pelo banco (sequência). "tag" é calculada e
-- gravada pelo servidor (api/negocio.js) logo depois do insert: não é coluna
-- gerada porque a normalização de acentos (função unaccent) não é permitida
-- em "generated column" do Postgres (exige função imutável).

create sequence if not exists public.negocios_numero_seq;

alter table public.negocios
  add column numero integer not null default nextval('public.negocios_numero_seq');

alter sequence public.negocios_numero_seq owned by public.negocios.numero;

alter table public.negocios
  add column tag text;

-- Preenche numero e tag dos negócios já existentes, na ordem de criação.
with numerados as (
  select id, row_number() over (order by criado_em) as n
  from public.negocios
)
update public.negocios n
set numero = numerados.n,
    tag = lpad(numerados.n::text, 4, '0') || '_Zuri_' || to_char(n.criado_em, 'YYYYMMDD') || '_' ||
      regexp_replace(regexp_replace(trim(n.nome), '[[:space:]]+', '_', 'g'), '[^A-Za-z0-9_]', '', 'g')
from numerados
where n.id = numerados.id;
