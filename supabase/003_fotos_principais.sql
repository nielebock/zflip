-- Todas as fotos (até 20) ficam guardadas; miniaturas seguem a mesma ordem de `fotos`;
-- fotos_principais são as até 4 que entram grandes no relatório, na ordem escolhida.
alter table public.negocios drop constraint if exists negocios_fotos_check;
alter table public.negocios add constraint negocios_fotos_max check (cardinality(fotos) <= 20);
alter table public.negocios add column if not exists miniaturas text[] not null default '{}';
alter table public.negocios add column if not exists fotos_principais text[] not null default '{}' check (cardinality(fotos_principais) <= 4);
