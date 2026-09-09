-- =====================================================================
--  0008 — Total du foyer, agrégé.
--
--  Problème résolu : la RLS retire les lignes privées du partenaire avant
--  qu'elles n'atteignent le navigateur. Le client ne peut donc PAS calculer
--  le total réel du foyer — les nombres ne lui parviennent jamais.
--
--  Cette fonction est `security definer` : elle lit les deux parts privées
--  et ne renvoie que des SOMMES. Aucune ligne, aucun libellé, aucune date,
--  aucune catégorie ne franchit la frontière.
--
--  LIMITE ASSUMÉE — à deux personnes, un total est une divulgation :
--  total − le mien = le privé de l'autre. La composition reste secrète,
--  la somme non. C'est un arbitrage validé, pas un oubli.
--
--  Sécurité : le foyer est DÉDUIT de auth.uid(), jamais reçu en paramètre.
--  Un identifiant de foyer passé par l'appelant serait forgeable.
-- =====================================================================

create or replace function public.household_totals(p_year int, p_month int)
returns table (
    total_income      numeric,
    total_expenses    numeric,
    fixed_expenses    numeric,
    variable_expenses numeric,
    total_bills       numeric,
    unpaid_bills      numeric,
    total_savings     numeric,
    total_invested    numeric,
    total_outflow     numeric,
    remaining_to_live numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_household uuid;
    v_income    numeric := 0;
    v_fixed     numeric := 0;
    v_variable  numeric := 0;
    v_bills     numeric := 0;
    v_unpaid    numeric := 0;
    v_savings   numeric := 0;
    v_invested  numeric := 0;
begin
    -- `security definer` contourne la RLS : sans ce garde-fou, un appelant
    -- anonyme lirait les totaux du foyer. Postgres accorde EXECUTE à PUBLIC
    -- par défaut, la révocation en fin de fichier est donc indispensable.
    if auth.uid() is null then
        raise exception 'Authentification requise';
    end if;

    select hm.household_id into v_household
      from public.household_members hm
     where hm.user_id = auth.uid()
     limit 1;

    if v_household is null then
        raise exception 'Vous n''appartenez à aucun foyer';
    end if;

    select coalesce(sum(i.amount), 0)
      into v_income
      from public.incomes i
     where i.household_id = v_household
       and i.deleted_at is null
       and i.year = p_year and i.month = p_month;

    select coalesce(sum(e.amount) filter (where e.kind = 'fixed'), 0),
           coalesce(sum(e.amount) filter (where e.kind = 'variable'), 0)
      into v_fixed, v_variable
      from public.expenses e
     where e.household_id = v_household
       and e.deleted_at is null
       and e.year = p_year and e.month = p_month;

    -- Toutes les factures du mois, payées ou non : c'est la définition
    -- retenue par computeMonthlyTotals côté client. Les deux cartes du
    -- tableau de bord doivent rester comparables.
    select coalesce(sum(b.amount), 0),
           coalesce(sum(b.amount) filter (where b.status <> 'paid'), 0)
      into v_bills, v_unpaid
      from public.bills b
     where b.household_id = v_household
       and b.deleted_at is null
       and b.year = p_year and b.month = p_month;

    select coalesce(sum(c.amount), 0)
      into v_savings
      from public.savings_contributions c
     where c.household_id = v_household
       and c.deleted_at is null
       and c.year = p_year and c.month = p_month;

    select coalesce(sum(inv.invested_amount), 0)
      into v_invested
      from public.investments inv
     where inv.household_id = v_household
       and inv.deleted_at is null
       and inv.year = p_year and inv.month = p_month;

    return query select
        v_income,
        (v_fixed + v_variable),
        v_fixed,
        v_variable,
        v_bills,
        v_unpaid,
        v_savings,
        v_invested,
        (v_fixed + v_variable + v_bills),
        (v_income - (v_fixed + v_variable + v_bills) - v_savings - v_invested);
end;
$$;

revoke all     on function public.household_totals(int, int) from public, anon;
grant  execute on function public.household_totals(int, int) to   authenticated;
