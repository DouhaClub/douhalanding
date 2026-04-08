-- Conteudo geral do site (textos, links, imagem da faixa "experiencia Douha") — uma linha por deploy.
create table if not exists public.douha_site_content (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.douha_site_content (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.douha_site_content enable row level security;

drop policy if exists "douha site content read public" on public.douha_site_content;
create policy "douha site content read public"
on public.douha_site_content
for select
to anon, authenticated
using (true);

drop policy if exists "douha site content write public" on public.douha_site_content;
create policy "douha site content write public"
on public.douha_site_content
for all
to anon, authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
