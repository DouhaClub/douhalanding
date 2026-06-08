-- Autoria e data de atualizacao nas materias editoriais.

alter table public.douha_editorial_posts
  add column if not exists author_name text not null default '';

alter table public.douha_editorial_posts
  add column if not exists author_avatar_url text not null default '';

alter table public.douha_editorial_posts
  add column if not exists updated_at timestamptz;

notify pgrst, 'reload schema';
