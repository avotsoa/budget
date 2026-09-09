-- =============================================================================
-- 0002 — Row Level Security
-- La séparation privé / partagé est appliquée ICI, au niveau du serveur.
-- L'interface ne fait que refléter ce que la base autorise déjà.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'aide en SECURITY DEFINER.
--
-- Indispensables : une policy sur `expenses` qui interrogerait directement
-- `household_members` déclencherait la RLS de cette table, dont la policy
-- interroge elle-même `household_members` → récursion infinie. Passer par des
-- fonctions SECURITY DEFINER coupe la chaîne.
-- `search_path` est figé pour éviter toute capture de nom.
-- -----------------------------------------------------------------------------

create or replace function public.is_household_member(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid()
  );
$$;

create or replace function public.my_partner_slot(p_household uuid)
returns owner_slot
language sql
stable
security definer
set search_path = public
as $$
  select partner_slot from public.household_members
  where household_id = p_household and user_id = auth.uid();
$$;

create or replace function public.my_role(p_household uuid)
returns member_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.household_members
  where household_id = p_household and user_id = auth.uid();
$$;

-- Droit d'écriture : owner et editor écrivent, viewer est en lecture seule.
create or replace function public.can_write(p_household uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role(p_household) in ('owner', 'editor');
$$;

-- Visibilité d'une ligne : elle est partagée, ou elle m'appartient.
-- C'est la règle qui rend les données privées de l'autre partenaire
-- littéralement illisibles, y compris via l'API REST et le temps réel.
create or replace function public.can_see_owner(p_household uuid, p_owner owner_slot)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_household_member(p_household)
     and (p_owner = 'shared' or p_owner = public.my_partner_slot(p_household));
$$;

grant execute on function
  public.is_household_member(uuid),
  public.my_partner_slot(uuid),
  public.my_role(uuid),
  public.can_write(uuid),
  public.can_see_owner(uuid, owner_slot)
to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges du rôle `authenticated`
--
-- Posés explicitement plutôt que de compter sur l'option « Automatically expose
-- new tables » du tableau de bord : elle est activée par défaut, mais Supabase
-- recommande de la désactiver pour maîtriser l'exposition table par table.
-- Avec ces GRANT, le projet fonctionne dans les deux configurations.
--
-- Accorder un privilège n'ouvre rien par lui-même : la RLS activée juste après
-- reste seule juge de la visibilité ligne à ligne. Le rôle `anon`, lui, ne
-- reçoit rien — aucune policy ne le vise.
-- -----------------------------------------------------------------------------
grant usage on schema public to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'households', 'household_members',
    'incomes', 'expenses', 'bills', 'savings_goals', 'savings_contributions',
    'investments', 'category_budgets', 'monthly_snapshots', 'notifications'
  ]
  loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Activation de la RLS partout
-- -----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.households            enable row level security;
alter table public.household_members     enable row level security;
alter table public.incomes               enable row level security;
alter table public.expenses              enable row level security;
alter table public.bills                 enable row level security;
alter table public.savings_goals         enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.investments           enable row level security;
alter table public.category_budgets      enable row level security;
alter table public.monthly_snapshots     enable row level security;
alter table public.notifications         enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- Je vois mon profil et celui des membres de mes foyers (pour afficher les noms).
-- -----------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- households / household_members
-- -----------------------------------------------------------------------------
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

-- La création passe par la RPC create_household() : elle seule génère un code
-- d'invitation unique et inscrit le créateur comme owner/partnerA.
drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.my_role(id) = 'owner')
  with check (public.my_role(id) = 'owner');

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_members_update on public.household_members;
create policy household_members_update on public.household_members
  for update to authenticated
  using (public.my_role(household_id) = 'owner')
  with check (public.my_role(household_id) = 'owner');

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (public.my_role(household_id) = 'owner' and user_id <> auth.uid());

-- -----------------------------------------------------------------------------
-- Tables financières — quatre policies identiques appliquées à chacune.
--
--   SELECT  : membre du foyer ET (ligne partagée OU ligne à moi)
--   INSERT  : idem + droit d'écriture + created_by = moi
--             + interdiction de créer une ligne privée au nom de l'autre
--   UPDATE  : idem SELECT + droit d'écriture, sur l'ancienne ET la nouvelle valeur
--   DELETE  : idem SELECT + droit d'écriture
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'incomes', 'expenses', 'bills', 'savings_goals',
    'savings_contributions', 'investments', 'category_budgets'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format($f$
      create policy %I_select on public.%I
        for select to authenticated
        using (public.can_see_owner(household_id, owner))
    $f$, t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$
      create policy %I_insert on public.%I
        for insert to authenticated
        with check (
          public.can_write(household_id)
          and public.can_see_owner(household_id, owner)
          and created_by = auth.uid()
        )
    $f$, t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format($f$
      create policy %I_update on public.%I
        for update to authenticated
        using  (public.can_write(household_id) and public.can_see_owner(household_id, owner))
        with check (public.can_write(household_id) and public.can_see_owner(household_id, owner))
    $f$, t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format($f$
      create policy %I_delete on public.%I
        for delete to authenticated
        using (public.can_write(household_id) and public.can_see_owner(household_id, owner))
    $f$, t, t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- monthly_snapshots / notifications — strictement personnels.
-- -----------------------------------------------------------------------------
drop policy if exists monthly_snapshots_all on public.monthly_snapshots;
create policy monthly_snapshots_all on public.monthly_snapshots
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists notifications_all on public.notifications;
create policy notifications_all on public.notifications
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- -----------------------------------------------------------------------------
-- Temps réel
-- La RLS s'applique aussi à la diffusion : le partenaire B ne reçoit jamais
-- les événements portant sur les lignes privées de A.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'incomes', 'expenses', 'bills', 'savings_goals', 'savings_contributions',
    'investments', 'category_budgets', 'notifications', 'household_members', 'profiles'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- déjà publiée
    end;
  end loop;
end $$;

-- Les UPDATE/DELETE temps réel doivent transporter l'ancienne ligne, sinon le
-- client ne sait pas quelle entrée retirer de son cache.
alter table public.incomes               replica identity full;
alter table public.expenses              replica identity full;
alter table public.bills                 replica identity full;
alter table public.savings_goals         replica identity full;
alter table public.savings_contributions replica identity full;
alter table public.investments           replica identity full;
alter table public.category_budgets      replica identity full;
