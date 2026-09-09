-- =============================================================================
-- 0001 — Schéma de base
-- Budget Couple : identité, foyer et tables financières.
-- À exécuter en premier dans le SQL Editor Supabase.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
-- Chaque type dans son propre bloc : un seul `exception` partagé ferait avorter
-- la création des types suivants dès que le premier existe déjà (ré-exécution).
do $$ begin
  create type owner_slot as enum ('partnerA', 'partnerB', 'shared');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_kind as enum ('fixed', 'variable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bill_status as enum ('paid', 'pending', 'overdue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type bill_freq as enum ('monthly', 'bimonthly', 'quarterly', 'biannual', 'annual', 'once');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invest_type as enum ('real_estate', 'stocks', 'crypto', 'life_insurance', 'long_term_savings', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type income_type as enum ('salary', 'bonus', 'freelance', 'benefits', 'rental', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_level as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Horodatage automatique
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — miroir applicatif de auth.users
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null default 'Partenaire',
  avatar_color text        not null default 'series-1',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Crée le profil dès l'inscription : l'application n'a jamais à gérer
-- le cas « utilisateur authentifié mais sans profil ».
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- households / household_members
-- -----------------------------------------------------------------------------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  invite_code text        not null unique,
  currency    text        not null default 'MGA',
  created_by  uuid        not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger households_touch
  before update on public.households
  for each row execute function public.touch_updated_at();

create table if not exists public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  role         member_role not null default 'editor',
  partner_slot owner_slot  not null,
  joined_at    timestamptz not null default now(),
  -- Un foyer contient exactement deux places : un utilisateur ne peut pas
  -- occuper « shared », qui désigne le pot commun et non une personne.
  constraint household_members_slot_is_person check (partner_slot <> 'shared'),
  constraint household_members_unique_user   unique (household_id, user_id),
  constraint household_members_unique_slot   unique (household_id, partner_slot)
);

create index if not exists household_members_user_idx on public.household_members (user_id);

-- -----------------------------------------------------------------------------
-- Tables financières
--
-- Toutes partagent la même ossature :
--   household_id · created_by · owner · owner_type (généré) · note
--   year / month (générés) · created_at · updated_at · deleted_at (soft delete)
--
-- `owner_type` est une colonne GÉNÉRÉE à partir de `owner` : les deux champs
-- demandés existent, mais avec une seule source de vérité — impossible de les
-- faire diverger.
-- -----------------------------------------------------------------------------

create table if not exists public.incomes (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  created_by   uuid        not null references public.profiles (id) on delete restrict,
  owner        owner_slot  not null,
  owner_type   text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  date         date        not null,
  year         int         generated always as (extract(year  from date)::int) stored,
  month        int         generated always as (extract(month from date)::int) stored,
  amount       numeric(12, 2) not null check (amount >= 0),
  income_type  income_type not null default 'salary',
  label        text        not null default '',
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  created_by   uuid        not null references public.profiles (id) on delete restrict,
  owner        owner_slot  not null,
  owner_type   text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  date         date        not null,
  year         int         generated always as (extract(year  from date)::int) stored,
  month        int         generated always as (extract(month from date)::int) stored,
  amount       numeric(12, 2) not null check (amount >= 0),
  category     text        not null,
  subcategory  text,
  kind         expense_kind not null default 'variable',
  -- Qui a effectivement sorti l'argent, indépendamment de qui « possède » la ligne :
  -- une dépense partagée peut être réglée par un seul des deux partenaires.
  paid_by      owner_slot  not null,
  label        text        not null default '',
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint expenses_paid_by_is_person check (paid_by <> 'shared')
);

create table if not exists public.bills (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  created_by   uuid        not null references public.profiles (id) on delete restrict,
  owner        owner_slot  not null,
  owner_type   text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  date         date        not null,                      -- date d'échéance
  year         int         generated always as (extract(year  from date)::int) stored,
  month        int         generated always as (extract(month from date)::int) stored,
  amount       numeric(12, 2) not null check (amount >= 0),
  label        text        not null,
  category     text        not null default 'Logement',
  frequency    bill_freq   not null default 'monthly',
  status       bill_status not null default 'pending',
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.savings_goals (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references public.households (id) on delete cascade,
  created_by    uuid        not null references public.profiles (id) on delete restrict,
  owner         owner_slot  not null,
  owner_type    text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  name          text        not null,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  target_date   date,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Le montant courant d'un objectif n'est PAS stocké : c'est la somme de ses
-- mouvements. Une seule source de vérité, et l'historique nécessaire au
-- graphique d'évolution de l'épargne existe par construction.
create table if not exists public.savings_contributions (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  goal_id      uuid        not null references public.savings_goals (id) on delete cascade,
  created_by   uuid        not null references public.profiles (id) on delete restrict,
  owner        owner_slot  not null,
  owner_type   text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  date         date        not null,
  year         int         generated always as (extract(year  from date)::int) stored,
  month        int         generated always as (extract(month from date)::int) stored,
  amount       numeric(12, 2) not null,   -- négatif = retrait
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table if not exists public.investments (
  id              uuid        primary key default gen_random_uuid(),
  household_id    uuid        not null references public.households (id) on delete cascade,
  created_by      uuid        not null references public.profiles (id) on delete restrict,
  owner           owner_slot  not null,
  owner_type      text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  date            date        not null,
  year            int         generated always as (extract(year  from date)::int) stored,
  month           int         generated always as (extract(month from date)::int) stored,
  label           text        not null,
  investment_type invest_type not null default 'stocks',
  invested_amount numeric(12, 2) not null check (invested_amount >= 0),
  current_value   numeric(12, 2) not null check (current_value >= 0),
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Plafonds mensuels par catégorie — support de l'alerte « dépassement de budget ».
create table if not exists public.category_budgets (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references public.households (id) on delete cascade,
  created_by    uuid        not null references public.profiles (id) on delete restrict,
  owner         owner_slot  not null default 'shared',
  owner_type    text        generated always as (case when owner = 'shared' then 'shared' else 'private' end) stored,
  category      text        not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint category_budgets_unique unique (household_id, owner, category)
);

-- Cache de synthèse mensuelle, PAR MEMBRE et non par foyer : un agrégat unique
-- pour le couple laisserait fuiter les données privées de l'autre partenaire
-- à travers les totaux. Chaque membre met en cache la vue que la RLS l'autorise
-- déjà à lire.
create table if not exists public.monthly_snapshots (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  year         int         not null,
  month        int         not null check (month between 1 and 12),
  payload      jsonb       not null,
  computed_at  timestamptz not null default now(),
  constraint monthly_snapshots_unique unique (household_id, user_id, year, month)
);

create table if not exists public.notifications (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references public.households (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  type         text        not null,
  severity     alert_level not null default 'info',
  title        text        not null,
  body         text        not null default '',
  -- Clé de déduplication : les règles d'alerte sont réévaluées à chaque
  -- chargement, l'upsert « on conflict do nothing » évite les doublons.
  dedupe_key   text        not null,
  read_at      timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint notifications_unique_dedupe unique (user_id, dedupe_key)
);

-- -----------------------------------------------------------------------------
-- Triggers updated_at + index de lecture
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- Toutes les tables financières : horodatage + filtre foyer/propriétaire.
  foreach t in array array[
    'incomes', 'expenses', 'bills', 'savings_goals',
    'savings_contributions', 'investments', 'category_budgets'
  ]
  loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);

    execute format(
      'create index if not exists %I_owner_idx on public.%I (household_id, owner)
       where deleted_at is null', t, t);
  end loop;

  -- Index de période réservé aux tables qui portent réellement year/month
  -- (savings_goals et category_budgets n'ont pas de date de mouvement).
  foreach t in array array[
    'incomes', 'expenses', 'bills', 'savings_contributions', 'investments'
  ]
  loop
    execute format(
      'create index if not exists %I_household_period_idx
       on public.%I (household_id, year desc, month desc) where deleted_at is null', t, t);
  end loop;
end $$;

create index if not exists expenses_category_idx
  on public.expenses (household_id, category) where deleted_at is null;
create index if not exists savings_contributions_goal_idx
  on public.savings_contributions (goal_id) where deleted_at is null;
create index if not exists notifications_inbox_idx
  on public.notifications (user_id, created_at desc);
