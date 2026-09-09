l'argent du foyer

with mouvements as (
    select 'Revenus'  as poste, owner,  amount as montant from public.incomes  where deleted_at is null
    union all
    select 'Dépenses',          owner, -amount            from public.expenses where deleted_at is null
    union all
    select 'Factures payées',   owner, -amount            from public.bills
        where deleted_at is null and status = 'paid'
),
agg as (
    select 1 as rang, poste,
        coalesce(sum(montant) filter (where owner = 'partnerA'), 0) as a,
        coalesce(sum(montant) filter (where owner = 'partnerB'), 0) as b,
        coalesce(sum(montant) filter (where owner = 'shared'),   0) as c,
        coalesce(sum(montant), 0) as t
    from mouvements group by poste
    union all
    select 2, '➜ SOLDE',
        coalesce(sum(montant) filter (where owner = 'partnerA'), 0),
        coalesce(sum(montant) filter (where owner = 'partnerB'), 0),
        coalesce(sum(montant) filter (where owner = 'shared'),   0),
        coalesce(sum(montant), 0)
    from mouvements
)
select poste as "Poste", a as "Rary (privé)", b as "Avotsoa (privé)",
       c as "Commun", t as "TOTAL FOYER"
from agg order by rang, poste;




mijery ligne ao anaty tables 
with foyer as (
    select id from public.households where invite_code = 'R9KGWT'
)
select 'revenus'              as donnees, count(*) as lignes from public.incomes               where household_id = (select id from foyer)
union all select 'dépenses',            count(*) from public.expenses              where household_id = (select id from foyer)
union all select 'factures',            count(*) from public.bills                 where household_id = (select id from foyer)
union all select 'objectifs épargne',   count(*) from public.savings_goals         where household_id = (select id from foyer)
union all select 'versements épargne',  count(*) from public.savings_contributions where household_id = (select id from foyer)
union all select 'investissements',     count(*) from public.investments           where household_id = (select id from foyer)
union all select 'budgets catégorie',   count(*) from public.category_budgets      where household_id = (select id from foyer)
union all select 'alertes',             count(*) from public.notifications         where household_id = (select id from foyer)
order by lignes desc;
