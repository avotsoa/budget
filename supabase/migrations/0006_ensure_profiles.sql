-- =============================================================================
-- 0006 — Fiabilisation de la création des profils
--
-- Symptôme : « insert or update on table "household_members" violates foreign
-- key constraint "household_members_user_id_fkey" » au moment de rejoindre un
-- foyer.
--
-- Cause : `profiles` est alimentée par le trigger `on_auth_user_created` posé
-- par la migration 0001. Tout compte inscrit AVANT l'exécution des migrations
-- n'a donc pas de profil, et la clé étrangère `user_id → profiles(id)` refuse
-- son rattachement.
--
-- Correction en deux temps :
--   1. rattrapage des comptes existants déjà orphelins ;
--   2. garantie à l'appel — create_household et join_household s'assurent
--      désormais elles-mêmes que le profil existe, plutôt que de faire
--      confiance à un trigger qui a pu ne pas être en place.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Crée à la demande le profil de l'appelant, s'il manque.
--
-- SECURITY DEFINER : `auth.users` n'est pas lisible par le rôle `authenticated`.
-- -----------------------------------------------------------------------------
create or replace function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  select
    u.id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      split_part(u.email, '@', 1)
    )
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

revoke execute on function public.ensure_profile() from public;
revoke execute on function public.ensure_profile() from anon;
grant  execute on function public.ensure_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- 1. Rattrapage : tous les comptes sans profil, quelle qu'en soit la raison.
-- -----------------------------------------------------------------------------
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- -----------------------------------------------------------------------------
-- 2. Garantie à l'appel
-- -----------------------------------------------------------------------------
create or replace function public.create_household(p_name text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household public.households;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  -- `households.created_by` et `household_members.user_id` référencent tous
  -- deux `profiles` : le profil doit exister avant la moindre insertion.
  perform public.ensure_profile();

  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Vous appartenez déjà à un foyer' using errcode = 'P0001';
  end if;

  insert into public.households (name, invite_code, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Notre foyer'), public.generate_invite_code(), v_user)
  returning * into v_household;

  insert into public.household_members (household_id, user_id, role, partner_slot)
  values (v_household.id, v_user, 'owner', 'partnerA');

  return v_household;
end;
$$;

create or replace function public.join_household(p_invite_code text)
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_household public.households;
  v_taken int;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  perform public.ensure_profile();

  if exists (select 1 from public.household_members where user_id = v_user) then
    raise exception 'Vous appartenez déjà à un foyer' using errcode = 'P0001';
  end if;

  select * into v_household
  from public.households
  where invite_code = upper(trim(p_invite_code));

  if v_household.id is null then
    raise exception 'Code d''invitation introuvable' using errcode = 'P0002';
  end if;

  select count(*) into v_taken
  from public.household_members
  where household_id = v_household.id;

  if v_taken >= 2 then
    raise exception 'Ce foyer est déjà complet' using errcode = 'P0003';
  end if;

  insert into public.household_members (household_id, user_id, role, partner_slot)
  values (v_household.id, v_user, 'editor', 'partnerB');

  return v_household;
end;
$$;

revoke execute on function public.create_household(text) from public, anon;
revoke execute on function public.join_household(text)  from public, anon;
grant  execute on function public.create_household(text) to authenticated;
grant  execute on function public.join_household(text)  to authenticated;
