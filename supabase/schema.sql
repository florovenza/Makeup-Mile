-- ==========================================================
-- Esquema del sitio. Pegar entero en Supabase → SQL Editor → Run.
-- Se puede volver a correr sin romper nada.
-- ==========================================================

-- Admins: quién puede editar
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.admins enable row level security;  -- sin políticas: nadie la lee ni escribe desde la web

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- Textos y fotos sueltas (clave → valor)
create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

-- Servicios
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  price text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Portfolio
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  path text,
  alt text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS: todo el mundo lee, solo admins escriben
do $$
declare t text;
begin
  foreach t in array array['site_content', 'services', 'gallery'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('drop policy if exists "admins escriben" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select using (true)', t);
    execute format('create policy "admins escriben" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Storage: bucket público para las fotos
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media lectura publica" on storage.objects;
drop policy if exists "media admins suben" on storage.objects;
drop policy if exists "media admins editan" on storage.objects;
drop policy if exists "media admins borran" on storage.objects;

create policy "media lectura publica" on storage.objects
  for select using (bucket_id = 'media');
create policy "media admins suben" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media admins editan" on storage.objects
  for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media admins borran" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- Los servicios del Canva se cargan con 02-servicios-canva.sql

-- ==========================================================
-- PASO FINAL (después de crear el usuario en Authentication → Users):
-- reemplazá el email y corré solo esta línea.
-- insert into public.admins (user_id) select id from auth.users where email = 'EMAIL_DE_LA_ADMIN' on conflict do nothing;
-- ==========================================================
