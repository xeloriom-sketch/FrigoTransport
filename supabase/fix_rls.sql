-- Exécuter dans Supabase SQL Editor APRÈS le schema.sql principal
-- Permet aux nouveaux utilisateurs d'insérer/modifier leur propre profil

-- 1. Permettre à un user de créer son propre profil (inscription)
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. Permettre upsert de son propre profil
drop policy if exists "Users can upsert own profile" on public.profiles;
create policy "Users can upsert own profile" on public.profiles
  for update using (auth.uid() = id);
