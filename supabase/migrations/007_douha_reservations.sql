-- Pre-reservas de mesas/camarotes por evento (sem pagamento no site).
-- Requer Supabase Auth com admin em app_metadata.role = 'admin' (ver 006_douha_rls_admin_auth.sql).

-- Garante helper de admin (idempotente se 006 ja foi aplicada).
create or replace function public.douha_is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

alter table public.douha_events
  add column if not exists reservations_enabled boolean not null default false;

alter table public.douha_events
  add column if not exists reservation_layout jsonb;

create table if not exists public.douha_table_reservations (
  id text primary key,
  event_id text not null references public.douha_events (id) on delete cascade,
  table_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  guest_name text not null,
  guest_phone text not null,
  guest_email text,
  party_size integer not null default 2 check (party_size > 0 and party_size <= 20),
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists douha_table_reservations_active_unique
  on public.douha_table_reservations (event_id, table_id)
  where status in ('pending', 'confirmed');

create index if not exists douha_table_reservations_event_idx
  on public.douha_table_reservations (event_id, created_at desc);

alter table public.douha_table_reservations enable row level security;

drop policy if exists "douha reservations select public" on public.douha_table_reservations;
create policy "douha reservations select public"
on public.douha_table_reservations for select
to anon, authenticated
using (true);

drop policy if exists "douha reservations insert public" on public.douha_table_reservations;
create policy "douha reservations insert public"
on public.douha_table_reservations for insert
to anon, authenticated
with check (
  status = 'pending'
  and length(trim(guest_name)) > 0
  and length(trim(guest_phone)) > 0
);

drop policy if exists "douha reservations update admin" on public.douha_table_reservations;
create policy "douha reservations update admin"
on public.douha_table_reservations for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

drop policy if exists "douha reservations delete admin" on public.douha_table_reservations;
create policy "douha reservations delete admin"
on public.douha_table_reservations for delete
to authenticated
using (public.douha_is_admin());

notify pgrst, 'reload schema';
