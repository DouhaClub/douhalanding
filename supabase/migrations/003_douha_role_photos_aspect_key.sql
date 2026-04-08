-- Formato de exibicao por foto na faixa "fotos do role" (mosaico na home).
alter table public.douha_role_photos
  add column if not exists aspect_key text not null default 'r34';

comment on column public.douha_role_photos.aspect_key is
  'Reservado; no site o mosaico usa sempre celula 3:4 (valor salvo r34).';

notify pgrst, 'reload schema';
