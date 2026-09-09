-- =============================================================================
-- 0005 — Correctif de sécurité sur les fonctions
--
-- Deux défauts découverts en sondant l'API REST avec la seule clé publique :
--
-- 1. `regenerate_invite_code` gardait l'accès par `my_role(...) <> 'owner'`.
--    Pour un non-membre, `my_role()` rend NULL, et `NULL <> 'owner'` vaut NULL
--    — ni vrai ni faux. Le `if` ne se déclenchait donc pas et la fonction
--    s'exécutait quand même. Corrigé par `is distinct from`, plus un contrôle
--    explicite de l'authentification.
--
-- 2. PostgreSQL accorde EXECUTE à PUBLIC par défaut sur toute fonction créée.
--    Sur une fonction SECURITY DEFINER, cela revient à l'ouvrir au rôle `anon`.
--    On révoque donc explicitement avant d'accorder au seul rôle `authenticated`.
--
-- Conséquence du cumul : un appelant anonyme connaissant l'UUID d'un foyer
-- pouvait en régénérer le code d'invitation et le recevoir en retour, donc
-- rejoindre ce foyer.
-- =============================================================================

create or replace function public.regenerate_invite_code(p_household uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  -- `is distinct from` traite NULL comme une valeur : un non-membre est bien
  -- « différent de owner », alors que `<>` rendait NULL et laissait passer.
  if public.my_role(p_household) is distinct from 'owner' then
    raise exception 'Seul le propriétaire du foyer peut régénérer le code'
      using errcode = '42501';
  end if;

  v_code := public.generate_invite_code();
  update public.households set invite_code = v_code where id = p_household;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges d'exécution : révoquer PUBLIC avant d'accorder nominativement.
--
-- L'ordre importe : un simple GRANT n'annule pas le privilège implicite de
-- PUBLIC, il s'y ajoute.
-- -----------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_household(text)',
    'public.join_household(text)',
    'public.regenerate_invite_code(uuid)',
    'public.seed_demo_data(boolean)',
    'public.is_household_member(uuid)',
    'public.my_partner_slot(uuid)',
    'public.my_role(uuid)',
    'public.can_write(uuid)',
    'public.can_see_owner(uuid, owner_slot)'
  ]
  loop
    execute format('revoke execute on function %s from public', fn);
    execute format('revoke execute on function %s from anon', fn);
    execute format('grant  execute on function %s to authenticated', fn);
  end loop;
end $$;

-- Jamais appelée directement : uniquement depuis create_household et
-- regenerate_invite_code, qui sont en SECURITY DEFINER.
revoke execute on function public.generate_invite_code() from public;
revoke execute on function public.generate_invite_code() from anon;
revoke execute on function public.generate_invite_code() from authenticated;
