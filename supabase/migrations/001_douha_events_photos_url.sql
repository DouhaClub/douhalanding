-- Migration Douha: coluna photos_url (link do Drive depois do evento)
--
-- Quando aparecer: "Could not find the 'photos_url' column ... in the schema cache"
-- rode APENAS este arquivo no SQL Editor (projeto que ja tinha douha_events).
--
-- E idempotente: pode rodar de novo sem quebrar.

alter table public.douha_events
add column if not exists photos_url text not null default '';

-- PostgREST (API do Supabase) recarrega o schema mais rapido.
notify pgrst, 'reload schema';
