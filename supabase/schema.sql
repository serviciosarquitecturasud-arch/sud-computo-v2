-- ============================================================================
-- SUD Cómputo v2 — esquema de la nube (H7)
-- Correr este archivo COMPLETO en el SQL Editor de Supabase (una sola vez).
--
-- Modelo: cada usuario registrado (auth.users) tiene su propio espacio:
--   catalogos   — 1 fila por usuario (todo el catálogo como JSON)
--   obras       — 1 fila por obra (el id es el mismo obra.id de la app)
--   revit_maps  — 1 fila por usuario (mapa de import Revit)
-- El JSON viaja completo en la columna `data` (passthrough, igual que en
-- localStorage): campos que el núcleo no conoce se preservan intactos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

-- Catálogo: una fila por usuario.
create table if not exists public.catalogos (
  -- Dueño de la fila; si se borra el usuario, se borran sus datos.
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Obras: una fila por obra. El id es el obra.id que ya genera la app.
create table if not exists public.obras (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Índice para listar rápido las obras de un usuario.
create index if not exists obras_user_id_idx on public.obras (user_id);

-- Mapa Revit: una fila por usuario.
create table if not exists public.revit_maps (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Trigger: mantener updated_at al día en cada UPDATE.
-- ----------------------------------------------------------------------------

create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalogos_updated_at on public.catalogos;
create trigger catalogos_updated_at
  before update on public.catalogos
  for each row execute function public.tocar_updated_at();

drop trigger if exists obras_updated_at on public.obras;
create trigger obras_updated_at
  before update on public.obras
  for each row execute function public.tocar_updated_at();

drop trigger if exists revit_maps_updated_at on public.revit_maps;
create trigger revit_maps_updated_at
  before update on public.revit_maps
  for each row execute function public.tocar_updated_at();

-- ----------------------------------------------------------------------------
-- Seguridad: RLS (Row Level Security).
-- La anon key del frontend es pública por diseño; ESTAS políticas son las que
-- garantizan que cada usuario solo ve y toca SUS propias filas.
-- ----------------------------------------------------------------------------

alter table public.catalogos  enable row level security;
alter table public.obras      enable row level security;
alter table public.revit_maps enable row level security;

-- catalogos: el usuario autenticado opera solo sobre su fila.
drop policy if exists "catalogos: propio select" on public.catalogos;
create policy "catalogos: propio select" on public.catalogos
  for select using (auth.uid() = user_id);
drop policy if exists "catalogos: propio insert" on public.catalogos;
create policy "catalogos: propio insert" on public.catalogos
  for insert with check (auth.uid() = user_id);
drop policy if exists "catalogos: propio update" on public.catalogos;
create policy "catalogos: propio update" on public.catalogos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "catalogos: propio delete" on public.catalogos;
create policy "catalogos: propio delete" on public.catalogos
  for delete using (auth.uid() = user_id);

-- obras: ídem, sobre todas sus obras.
drop policy if exists "obras: propio select" on public.obras;
create policy "obras: propio select" on public.obras
  for select using (auth.uid() = user_id);
drop policy if exists "obras: propio insert" on public.obras;
create policy "obras: propio insert" on public.obras
  for insert with check (auth.uid() = user_id);
drop policy if exists "obras: propio update" on public.obras;
create policy "obras: propio update" on public.obras
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "obras: propio delete" on public.obras;
create policy "obras: propio delete" on public.obras
  for delete using (auth.uid() = user_id);

-- revit_maps: ídem.
drop policy if exists "revit_maps: propio select" on public.revit_maps;
create policy "revit_maps: propio select" on public.revit_maps
  for select using (auth.uid() = user_id);
drop policy if exists "revit_maps: propio insert" on public.revit_maps;
create policy "revit_maps: propio insert" on public.revit_maps
  for insert with check (auth.uid() = user_id);
drop policy if exists "revit_maps: propio update" on public.revit_maps;
create policy "revit_maps: propio update" on public.revit_maps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "revit_maps: propio delete" on public.revit_maps;
create policy "revit_maps: propio delete" on public.revit_maps
  for delete using (auth.uid() = user_id);
