-- =============================================================================
-- Douha: LIMPAR DADOS para testar de novo (nao remove tabelas nem policies)
-- Rode no Supabase → SQL Editor → New query → colar → Run
-- =============================================================================
-- Apaga: eventos, fotos do site, materias, fotos do role, e arquivos nos buckets.
-- =============================================================================

begin;

delete from public.douha_role_photos;
delete from public.douha_editorial_posts;
delete from public.douha_site_photos;
delete from public.douha_events;

delete from storage.objects
where bucket_id in (
  'douha-posters',
  'douha-gallery',
  'douha-role-photos'
);

commit;

notify pgrst, 'reload schema';

-- Opcional no navegador (DevTools → Application → Local Storage do seu dominio):
-- remova chaves que comecam com douha_ se quiser zerar cache local do painel.
