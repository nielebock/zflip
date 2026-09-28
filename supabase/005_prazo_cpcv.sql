-- Prazo para CPCV, em dias, contado a partir da data de criação da proposta.
-- Usado na folha de proposta para calcular Data CPCV e Data de venda prevista
-- (Data CPCV = Data de criação + prazo_cpcv_dias; Data de venda = Data CPCV + prazo_meses).

alter table public.negocios
  add column prazo_cpcv_dias integer not null default 30 check (prazo_cpcv_dias >= 0);
