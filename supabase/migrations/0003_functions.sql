-- =============================================================================
-- 0003 — Fonctions applicatives
-- Création / rattachement de foyer, et vue agrégée des objectifs d'épargne.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Code d'invitation : 6 caractères, alphabet sans I/O/0/1 pour éviter les
-- confusions à la lecture ou à la dictée.
-- -----------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

-- -----------------------------------------------------------------------------
-- ensure_profile — crée à la demande le profil de l'appelant, s'il manque.
--
-- Filet de sécurité du trigger `on_auth_user_created` : un compte inscrit avant
-- la pose de ce trigger n'aurait pas de profil, et toutes les clés étrangères
-- pointant vers `profiles` échoueraient. SECURITY DEFINER, car `auth.users`
-- n'est pas lisible par le rôle `authenticated`.
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

revoke execute on function public.ensure_profile() from public, anon;
grant execute on function public.ensure_profile() to authenticated;

-- -----------------------------------------------------------------------------
-- create_household — crée le foyer et inscrit l'appelant en owner / partnerA.
-- Passe par une RPC plutôt qu'un INSERT direct : le foyer et son premier membre
-- doivent naître dans la même transaction, sinon un échec laisse un foyer
-- orphelin que plus personne ne peut lire (la RLS exige d'en être membre).
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
  -- deux `profiles`. Ne pas dépendre du seul trigger `on_auth_user_created` :
  -- un compte inscrit avant la pose de ce trigger n'aurait pas de profil.
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

-- -----------------------------------------------------------------------------
-- join_household — rattache l'appelant à un foyer existant via son code.
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- regenerate_invite_code — permet au propriétaire d'invalider un code diffusé.
-- -----------------------------------------------------------------------------
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

  -- `is distinct from` et non `<>` : pour un non-membre, my_role() rend NULL,
  -- et `NULL <> 'owner'` vaut NULL — donc le garde-fou ne se déclencherait pas.
  if public.my_role(p_household) is distinct from 'owner' then
    raise exception 'Seul le propriétaire du foyer peut régénérer le code' using errcode = '42501';
  end if;

  v_code := public.generate_invite_code();
  update public.households set invite_code = v_code where id = p_household;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Vue des objectifs d'épargne avec leur montant courant.
-- Le total est calculé, jamais stocké : impossible qu'il diverge des mouvements.
-- La vue hérite de la RLS des tables sous-jacentes (security_invoker).
-- -----------------------------------------------------------------------------
create or replace view public.savings_goals_with_progress
with (security_invoker = true)
as
select
  g.*,
  coalesce(c.total, 0)::numeric(12, 2) as current_amount,
  case
    when g.target_amount > 0
      then least(100, greatest(0, round(coalesce(c.total, 0) / g.target_amount * 100, 1)))
    else 0
  end as progress_percent
from public.savings_goals g
left join lateral (
  select sum(amount) as total
  from public.savings_contributions sc
  where sc.goal_id = g.id and sc.deleted_at is null
) c on true
where g.deleted_at is null;

grant select on public.savings_goals_with_progress to authenticated;

-- PostgreSQL accorde EXECUTE à PUBLIC par défaut : sur une fonction
-- SECURITY DEFINER, cela revient à l'ouvrir au rôle `anon`. Il faut donc
-- révoquer avant d'accorder — un GRANT seul s'ajoute au privilège implicite
-- de PUBLIC au lieu de le remplacer.
revoke execute on function
  public.create_household(text),
  public.join_household(text),
  public.regenerate_invite_code(uuid)
from public, anon;

grant execute on function
  public.create_household(text),
  public.join_household(text),
  public.regenerate_invite_code(uuid)
to authenticated;

-- generate_invite_code n'est appelée que depuis les fonctions ci-dessus.
revoke execute on function public.generate_invite_code() from public, anon, authenticated;
