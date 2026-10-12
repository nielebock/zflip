-- ZFlip 2.0: schema consolidado das migrações 001 a 005 do Supabase, para o Neon.
-- Sem RLS (não existe no Neon puro) e sem bucket de Storage (arquivos vão para
-- o SharePoint via Microsoft Graph, fora do banco).
-- Percentuais são guardados como fração (0.05 = 5%), o mesmo formato do motor de cálculo.
-- Em remodelacao_valor_ou_pct: fração se modo_remodelacao = 'pct', euros se 'fixo'.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

create sequence if not exists public.negocios_numero_seq;

create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text check (nome is null or char_length(nome) <= 80),

  preco_venda numeric not null,
  preco_compra numeric,
  aplicar_imt boolean not null default true,
  comissao_venda_pct numeric not null,
  iva_comissao_pct numeric not null,
  roi_alvo_pct numeric not null,
  prazo_meses integer not null check (prazo_meses >= 0),
  prazo_cpcv_dias integer not null default 30 check (prazo_cpcv_dias >= 0),
  modo_remodelacao text not null check (modo_remodelacao in ('pct', 'fixo')),
  remodelacao_valor_ou_pct numeric not null,
  custos_juridicos_pct numeric not null,
  escritura_registos_pct numeric not null,
  imposto_selo_pct numeric not null,
  outros_custos_pct numeric not null,
  imi_anual_pct numeric not null,

  resultado_conta_direta jsonb,
  resultado_conta_reversa jsonb not null,

  fotos text[] not null default '{}' check (cardinality(fotos) <= 20),
  miniaturas text[] not null default '{}',
  fotos_principais text[] not null default '{}' check (cardinality(fotos_principais) <= 4),
  documentos text[] not null default '{}',
  pdf_path text,

  numero integer not null default nextval('public.negocios_numero_seq'),
  tag text
);

alter sequence public.negocios_numero_seq owned by public.negocios.numero;
