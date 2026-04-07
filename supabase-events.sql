-- =============================================================================
-- Douha: SETUP BASE (rode no SQL Editor)
-- =============================================================================
-- Projetos NOVOS: rode este arquivo inteiro, depois rode tambem:
--   supabase/migrations/001_douha_events_photos_url.sql
-- (Mantemos migrations separadas para nao depender de "create table" antigo.)
--
-- Projetos que JA existiam e so faltam colunas novas: rode SOMENTE os arquivos
-- em supabase/migrations/ que ainda nao rodou (comecando pelo 001).
-- =============================================================================

create table if not exists public.douha_events (
  id text primary key,
  date text not null,
  time text not null default 'A CONFIRMAR',
  lineup text not null,
  poster text not null default '',
  ticket_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.douha_events
drop column if exists sort_order;

alter table public.douha_events enable row level security;

create table if not exists public.douha_site_photos (
  id text primary key,
  photo_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.douha_site_photos enable row level security;

insert into storage.buckets (id, name, public)
values ('douha-posters', 'douha-posters', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('douha-gallery', 'douha-gallery', true)
on conflict (id) do nothing;

-- WARNING: Politicas abertas para permitir operar apenas com chave anon no frontend.
-- Para producao com seguranca, mover operacoes admin para backend/autenticacao.
drop policy if exists "douha events read public" on public.douha_events;
create policy "douha events read public"
on public.douha_events
for select
to anon, authenticated
using (true);

drop policy if exists "douha events write public" on public.douha_events;
create policy "douha events write public"
on public.douha_events
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "douha gallery read public" on public.douha_site_photos;
create policy "douha gallery read public"
on public.douha_site_photos
for select
to anon, authenticated
using (true);

drop policy if exists "douha gallery write public" on public.douha_site_photos;
create policy "douha gallery write public"
on public.douha_site_photos
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "douha posters read public" on storage.objects;
create policy "douha posters read public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'douha-posters');

drop policy if exists "douha posters write public" on storage.objects;
create policy "douha posters write public"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'douha-posters');

drop policy if exists "douha gallery read storage public" on storage.objects;
create policy "douha gallery read storage public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'douha-gallery');

drop policy if exists "douha gallery write storage public" on storage.objects;
create policy "douha gallery write storage public"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'douha-gallery');

-- Proximo passo: rode supabase/migrations/001_douha_events_photos_url.sql
-- (sem isso o site novo quebra ao salvar evento com link de fotos no Drive.)
