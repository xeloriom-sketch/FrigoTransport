-- ============================================================
-- FrigoTransport — Schéma Supabase
-- Exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================

create extension if not exists "uuid-ossp";

-- Profils (liés aux utilisateurs Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null default 'worker' check (role in ('admin', 'worker')),
  phone text,
  created_at timestamptz default now()
);

-- Camions
create table public.trucks (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  plate_number text not null unique,
  qr_token uuid not null default uuid_generate_v4() unique,
  created_at timestamptz default now()
);

-- Affectations (quel ouvrier dans quel camion)
create table public.assignments (
  id uuid primary key default uuid_generate_v4(),
  truck_id uuid references public.trucks on delete cascade not null,
  worker_id uuid references public.profiles on delete cascade not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  is_active boolean default true
);

-- Historique de positions GPS
create table public.locations (
  id uuid primary key default uuid_generate_v4(),
  assignment_id uuid references public.assignments on delete cascade not null,
  truck_id uuid references public.trucks on delete cascade not null,
  worker_id uuid references public.profiles on delete cascade not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  speed double precision,
  heading double precision,
  recorded_at timestamptz default now()
);

-- Index pour les performances
create index idx_locations_truck_id on public.locations(truck_id);
create index idx_locations_recorded_at on public.locations(recorded_at desc);
create index idx_assignments_is_active on public.assignments(is_active);
create index idx_assignments_worker_id on public.assignments(worker_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.trucks enable row level security;
alter table public.assignments enable row level security;
alter table public.locations enable row level security;

-- Fonction helper: est-ce un admin ?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Profils
create policy "Voir son profil" on public.profiles for select using (auth.uid() = id);
create policy "Admin: voir tous les profils" on public.profiles for select using (public.is_admin());
create policy "Admin: modifier tous les profils" on public.profiles for all using (public.is_admin());
create policy "Modifier son profil" on public.profiles for update using (auth.uid() = id);

-- Camions (tous les authentifiés peuvent voir)
create policy "Voir les camions" on public.trucks for select using (auth.role() = 'authenticated');
create policy "Admin: gérer les camions" on public.trucks for all using (public.is_admin());

-- Affectations
create policy "Voir ses affectations" on public.assignments for select using (worker_id = auth.uid());
create policy "Créer son affectation" on public.assignments for insert with check (worker_id = auth.uid());
create policy "Modifier son affectation" on public.assignments for update using (worker_id = auth.uid());
create policy "Admin: gérer les affectations" on public.assignments for all using (public.is_admin());

-- Positions GPS
create policy "Insérer ses positions" on public.locations for insert with check (worker_id = auth.uid());
create policy "Voir ses positions" on public.locations for select using (worker_id = auth.uid());
create policy "Admin: voir toutes les positions" on public.locations for select using (public.is_admin());

-- ============================================================
-- Trigger: créer profil à l'inscription
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'worker')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Vue: dernière position par camion (pour la carte admin)
-- ============================================================

create or replace view public.truck_latest_positions as
select distinct on (l.truck_id)
  l.truck_id,
  t.name as truck_name,
  t.plate_number,
  p.full_name as worker_name,
  l.latitude,
  l.longitude,
  l.accuracy,
  l.speed,
  l.recorded_at,
  a.id as assignment_id
from public.locations l
join public.trucks t on t.id = l.truck_id
join public.profiles p on p.id = l.worker_id
join public.assignments a on a.id = l.assignment_id
where a.is_active = true
order by l.truck_id, l.recorded_at desc;

grant select on public.truck_latest_positions to authenticated;

-- ============================================================
-- Realtime: activer pour les mises à jour live
-- ============================================================

alter publication supabase_realtime add table public.locations;
alter publication supabase_realtime add table public.assignments;
