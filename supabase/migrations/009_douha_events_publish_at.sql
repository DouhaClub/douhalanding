-- Publicação agendada de eventos do calendário.
-- publish_at NULL = visível imediatamente (eventos existentes continuam assim).
-- publish_at no futuro = só admin vê até o horário; depois aparece no site público.

alter table public.douha_events
  add column if not exists publish_at timestamptz;

comment on column public.douha_events.publish_at is
  'Quando o evento fica visível no site. NULL = publicado imediatamente.';

drop policy if exists "douha events select public" on public.douha_events;

create policy "douha events select public"
on public.douha_events for select
to anon, authenticated
using (
  publish_at is null
  or publish_at <= now()
  or public.douha_is_admin()
);

notify pgrst, 'reload schema';
