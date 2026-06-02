-- Seguranca: leitura publica, escrita apenas para admins autenticados (Supabase Auth).
--
-- Apos rodar esta migration, crie um usuario admin no painel Supabase:
--   Authentication → Users → Add user → e-mail + senha forte
--   User → Raw App Meta Data: { "role": "admin" }
-- (Nao use user_metadata para autorizacao — apenas app_metadata.)
--
-- O site faz login com supabase.auth.signInWithPassword no /admin.

-- Helper: admin definido em app_metadata.role = 'admin'
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

-- ---------- douha_events ----------
drop policy if exists "douha events read public" on public.douha_events;
drop policy if exists "douha events write public" on public.douha_events;
drop policy if exists "douha events select public" on public.douha_events;
drop policy if exists "douha events insert admin" on public.douha_events;
drop policy if exists "douha events update admin" on public.douha_events;
drop policy if exists "douha events delete admin" on public.douha_events;

create policy "douha events select public"
on public.douha_events for select
to anon, authenticated
using (true);

create policy "douha events insert admin"
on public.douha_events for insert
to authenticated
with check (public.douha_is_admin());

create policy "douha events update admin"
on public.douha_events for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

create policy "douha events delete admin"
on public.douha_events for delete
to authenticated
using (public.douha_is_admin());

-- ---------- douha_site_photos ----------
drop policy if exists "douha gallery read public" on public.douha_site_photos;
drop policy if exists "douha gallery write public" on public.douha_site_photos;
drop policy if exists "douha gallery select public" on public.douha_site_photos;
drop policy if exists "douha gallery insert admin" on public.douha_site_photos;
drop policy if exists "douha gallery update admin" on public.douha_site_photos;
drop policy if exists "douha gallery delete admin" on public.douha_site_photos;

create policy "douha gallery select public"
on public.douha_site_photos for select
to anon, authenticated
using (true);

create policy "douha gallery insert admin"
on public.douha_site_photos for insert
to authenticated
with check (public.douha_is_admin());

create policy "douha gallery update admin"
on public.douha_site_photos for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

create policy "douha gallery delete admin"
on public.douha_site_photos for delete
to authenticated
using (public.douha_is_admin());

-- ---------- douha_editorial_posts ----------
drop policy if exists "douha editorial read public" on public.douha_editorial_posts;
drop policy if exists "douha editorial write public" on public.douha_editorial_posts;
drop policy if exists "douha editorial select public" on public.douha_editorial_posts;
drop policy if exists "douha editorial select admin" on public.douha_editorial_posts;
drop policy if exists "douha editorial insert admin" on public.douha_editorial_posts;
drop policy if exists "douha editorial update admin" on public.douha_editorial_posts;
drop policy if exists "douha editorial delete admin" on public.douha_editorial_posts;

create policy "douha editorial select public"
on public.douha_editorial_posts for select
to anon, authenticated
using (is_published = true or public.douha_is_admin());

create policy "douha editorial insert admin"
on public.douha_editorial_posts for insert
to authenticated
with check (public.douha_is_admin());

create policy "douha editorial update admin"
on public.douha_editorial_posts for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

create policy "douha editorial delete admin"
on public.douha_editorial_posts for delete
to authenticated
using (public.douha_is_admin());

-- ---------- douha_role_photos ----------
drop policy if exists "douha role photos read public" on public.douha_role_photos;
drop policy if exists "douha role photos write public" on public.douha_role_photos;
drop policy if exists "douha role photos select public" on public.douha_role_photos;
drop policy if exists "douha role photos insert admin" on public.douha_role_photos;
drop policy if exists "douha role photos update admin" on public.douha_role_photos;
drop policy if exists "douha role photos delete admin" on public.douha_role_photos;

create policy "douha role photos select public"
on public.douha_role_photos for select
to anon, authenticated
using (true);

create policy "douha role photos insert admin"
on public.douha_role_photos for insert
to authenticated
with check (public.douha_is_admin());

create policy "douha role photos update admin"
on public.douha_role_photos for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

create policy "douha role photos delete admin"
on public.douha_role_photos for delete
to authenticated
using (public.douha_is_admin());

-- ---------- douha_site_content ----------
drop policy if exists "douha site content read public" on public.douha_site_content;
drop policy if exists "douha site content write public" on public.douha_site_content;
drop policy if exists "douha site content select public" on public.douha_site_content;
drop policy if exists "douha site content insert admin" on public.douha_site_content;
drop policy if exists "douha site content update admin" on public.douha_site_content;
drop policy if exists "douha site content delete admin" on public.douha_site_content;

create policy "douha site content select public"
on public.douha_site_content for select
to anon, authenticated
using (true);

create policy "douha site content insert admin"
on public.douha_site_content for insert
to authenticated
with check (public.douha_is_admin());

create policy "douha site content update admin"
on public.douha_site_content for update
to authenticated
using (public.douha_is_admin())
with check (public.douha_is_admin());

create policy "douha site content delete admin"
on public.douha_site_content for delete
to authenticated
using (public.douha_is_admin());

-- ---------- Storage: leitura publica, escrita admin ----------
drop policy if exists "douha posters write public" on storage.objects;
drop policy if exists "douha gallery write storage public" on storage.objects;
drop policy if exists "douha role photos storage write public" on storage.objects;
drop policy if exists "douha role photos storage delete public" on storage.objects;

drop policy if exists "douha posters insert admin" on storage.objects;
drop policy if exists "douha posters update admin" on storage.objects;
drop policy if exists "douha posters delete admin" on storage.objects;
drop policy if exists "douha gallery insert admin" on storage.objects;
drop policy if exists "douha gallery update admin" on storage.objects;
drop policy if exists "douha gallery delete admin" on storage.objects;
drop policy if exists "douha role photos insert admin" on storage.objects;
drop policy if exists "douha role photos update admin" on storage.objects;
drop policy if exists "douha role photos delete admin" on storage.objects;

create policy "douha posters insert admin"
on storage.objects for insert to authenticated
with check (bucket_id = 'douha-posters' and public.douha_is_admin());

create policy "douha posters update admin"
on storage.objects for update to authenticated
using (bucket_id = 'douha-posters' and public.douha_is_admin())
with check (bucket_id = 'douha-posters' and public.douha_is_admin());

create policy "douha posters delete admin"
on storage.objects for delete to authenticated
using (bucket_id = 'douha-posters' and public.douha_is_admin());

create policy "douha gallery insert admin"
on storage.objects for insert to authenticated
with check (bucket_id = 'douha-gallery' and public.douha_is_admin());

create policy "douha gallery update admin"
on storage.objects for update to authenticated
using (bucket_id = 'douha-gallery' and public.douha_is_admin())
with check (bucket_id = 'douha-gallery' and public.douha_is_admin());

create policy "douha gallery delete admin"
on storage.objects for delete to authenticated
using (bucket_id = 'douha-gallery' and public.douha_is_admin());

create policy "douha role photos insert admin"
on storage.objects for insert to authenticated
with check (bucket_id = 'douha-role-photos' and public.douha_is_admin());

create policy "douha role photos update admin"
on storage.objects for update to authenticated
using (bucket_id = 'douha-role-photos' and public.douha_is_admin())
with check (bucket_id = 'douha-role-photos' and public.douha_is_admin());

create policy "douha role photos delete admin"
on storage.objects for delete to authenticated
using (bucket_id = 'douha-role-photos' and public.douha_is_admin());

notify pgrst, 'reload schema';
