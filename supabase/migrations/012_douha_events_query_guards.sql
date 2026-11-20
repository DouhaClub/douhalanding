-- Proteções contra leituras lentas / pressão no calendário público.
-- Índices para o filtro de publish_at (RLS) e a ordenação usada pelo site.

create index if not exists douha_events_publish_at_idx
  on public.douha_events (publish_at);

create index if not exists douha_events_created_at_idx
  on public.douha_events (created_at);

-- Select público: evita chamar douha_is_admin() em toda linha para anon.
-- Admin continua vendo agendados via policy separada.
drop policy if exists "douha events select public" on public.douha_events;
drop policy if exists "douha events select published" on public.douha_events;
drop policy if exists "douha events select admin all" on public.douha_events;

create policy "douha events select published"
on public.douha_events for select
to anon, authenticated
using (
  publish_at is null
  or publish_at <= now()
);

create policy "douha events select admin all"
on public.douha_events for select
to authenticated
using (public.douha_is_admin());

notify pgrst, 'reload schema';
