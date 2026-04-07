-- Migration Douha: editorial posts + role photos
-- Persistencia para painel admin (materias e fotos do role).

create table if not exists public.douha_editorial_posts (
  id text primary key,
  title text not null,
  deck text not null default '',
  body text not null default '',
  source text not null default 'DOUHA CLUB',
  issue text not null default '',
  category text not null default '',
  cover_url text not null default '',
  published_at timestamptz,
  is_published boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.douha_editorial_posts enable row level security;

drop policy if exists "douha editorial read public" on public.douha_editorial_posts;
create policy "douha editorial read public"
on public.douha_editorial_posts
for select
to anon, authenticated
using (true);

drop policy if exists "douha editorial write public" on public.douha_editorial_posts;
create policy "douha editorial write public"
on public.douha_editorial_posts
for all
to anon, authenticated
using (true)
with check (true);

create table if not exists public.douha_role_photos (
  id text primary key,
  photo_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.douha_role_photos enable row level security;

drop policy if exists "douha role photos read public" on public.douha_role_photos;
create policy "douha role photos read public"
on public.douha_role_photos
for select
to anon, authenticated
using (true);

drop policy if exists "douha role photos write public" on public.douha_role_photos;
create policy "douha role photos write public"
on public.douha_role_photos
for all
to anon, authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('douha-role-photos', 'douha-role-photos', true)
on conflict (id) do nothing;

drop policy if exists "douha role photos storage read public" on storage.objects;
create policy "douha role photos storage read public"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'douha-role-photos');

drop policy if exists "douha role photos storage write public" on storage.objects;
create policy "douha role photos storage write public"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'douha-role-photos');

drop policy if exists "douha role photos storage delete public" on storage.objects;
create policy "douha role photos storage delete public"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'douha-role-photos');

notify pgrst, 'reload schema';
