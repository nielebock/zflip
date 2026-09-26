-- Nome do imóvel ou projeto, informado ao gerar ou enviar o relatório.
alter table public.negocios add column if not exists nome text check (nome is null or char_length(nome) <= 80);
