-- Lista de fontes/links por materia editorial (JSON array no admin).
alter table public.douha_editorial_posts
  add column if not exists sources text not null default '';

notify pgrst, 'reload schema';
