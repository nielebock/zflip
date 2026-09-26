-- ZFlip: tabela de negócios e bucket de arquivos.
-- Percentuais são guardados como fração (0.05 = 5%), o mesmo formato do motor de cálculo.
-- Em remodelacao_valor_ou_pct: fração se modo_remodelacao = 'pct', euros se 'fixo'.

create table if not exists public.negocios (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),

  preco_venda numeric not null,
  preco_compra numeric,
  aplicar_imt boolean not null default true,
  comissao_venda_pct numeric not null,
  iva_comissao_pct numeric not null,
  roi_alvo_pct numeric not null,
  prazo_meses integer not null check (prazo_meses >= 0),
  modo_remodelacao text not null check (modo_remodelacao in ('pct', 'fixo')),
  remodelacao_valor_ou_pct numeric not null,
  custos_juridicos_pct numeric not null,
  escritura_registos_pct numeric not null,
  imposto_selo_pct numeric not null,
  outros_custos_pct numeric not null,
  imi_anual_pct numeric not null,

  resultado_conta_direta jsonb,
  resultado_conta_reversa jsonb not null,

  fotos text[] not null default '{}' check (cardinality(fotos) <= 4),
  documentos text[] not null default '{}',
  pdf_path text
);

-- RLS ativo, sem nenhuma política: anon e authenticated não acessam nada.
-- Todo acesso passa pela Secret key dentro das Vercel Functions.
alter table public.negocios enable row level security;

-- Bucket privado, sem políticas em storage.objects para anon.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos-negocios', 'documentos-negocios', false, 52428800)
on conflict (id) do nothing;
