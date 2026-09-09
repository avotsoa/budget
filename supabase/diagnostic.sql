-- =====================================================================
--  DIAGNOSTIC — à coller dans Supabase > SQL Editor
--
--  Le SQL Editor s'exécute avec un rôle privilégié : il IGNORE la RLS.
--  C'est donc le seul endroit où l'on voit le foyer en entier, les deux
--  parts privées comprises. L'application, elle, ne le pourra jamais —
--  c'est voulu.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Les deux comptes sont-ils bien dans LE MÊME foyer ?
--    Si cette requête renvoie deux lignes avec deux `household_id`
--    différents, tout le reste s'explique : Rary a créé son propre foyer
--    au lieu de rejoindre celui d'Avotsoa avec le code d'invitation.
-- ---------------------------------------------------------------------
select
    h.name          as foyer,
    h.invite_code   as code,
    m.partner_slot  as slot,
    m.role,
    p.display_name  as membre,
    u.email
from public.household_members m
join public.households h on h.id = m.household_id
join public.profiles   p on p.id = m.user_id
join auth.users        u on u.id = m.user_id
order by h.created_at, m.partner_slot;


-- ---------------------------------------------------------------------
-- 2. L'ARGENT — tout le foyer, sans filtre de confidentialité.
--
--    `owner` vaut 'partnerA', 'partnerB' ou 'shared'.
--    Une ligne 'partnerA' n'est visible que par le partenaire A.
-- ---------------------------------------------------------------------
-- Foyer « budget vacance » : partnerA = Rary, partnerB = Avotsoa.
with mouvements as (
    select 'Revenus'  as poste, owner,  amount as montant from public.incomes  where deleted_at is null
    union all
    select 'Dépenses',          owner, -amount            from public.expenses where deleted_at is null
    union all
    -- Toutes les factures, payées ou non : c'est la convention du tableau
    -- de bord (computeMonthlyTotals). Les chiffres restent comparables.
    select 'Factures',          owner, -amount            from public.bills
        where deleted_at is null
),
agg as (
    select
        1 as rang,
        poste,
        coalesce(sum(montant) filter (where owner = 'partnerA'), 0) as rary_prive,
        coalesce(sum(montant) filter (where owner = 'partnerB'), 0) as avotsoa_prive,
        coalesce(sum(montant) filter (where owner = 'shared'),   0) as commun,
        coalesce(sum(montant), 0)                                   as total
    from mouvements
    group by poste

    union all

    select
        2,
        '➜ SOLDE',
        coalesce(sum(montant) filter (where owner = 'partnerA'), 0),
        coalesce(sum(montant) filter (where owner = 'partnerB'), 0),
        coalesce(sum(montant) filter (where owner = 'shared'),   0),
        coalesce(sum(montant), 0)
    from mouvements
)
select
    poste             as "Poste",
    rary_prive        as "Rary (privé)",
    avotsoa_prive     as "Avotsoa (privé)",
    commun            as "Commun",
    total             as "TOTAL FOYER"
from agg
order by rang, poste;


-- ---------------------------------------------------------------------
-- 3. L'ÉPARGNE et les INVESTISSEMENTS (des stocks, pas des flux :
--    ils ne s'additionnent pas au solde ci-dessus).
-- ---------------------------------------------------------------------
select
    'Épargne versée' as poste,
    c.owner,
    sum(c.amount)    as montant
from public.savings_contributions c
where c.deleted_at is null
group by c.owner

union all

select
    'Investissements (valeur actuelle)',
    i.owner,
    sum(i.current_value)
from public.investments i
where i.deleted_at is null
group by i.owner

order by poste, owner;


-- ---------------------------------------------------------------------
-- 4. LES 25 DERNIÈRES ÉCRITURES, avec leur propriétaire.
--
--    C'est ici que vous verrez, noir sur blanc, pourquoi telle ligne
--    n'apparaît pas chez l'autre : regardez la colonne `owner`.
--    Tout ce qui n'est pas 'shared' est invisible pour le partenaire.
-- ---------------------------------------------------------------------
select
    type          as "Type",
    date          as "Date",
    amount        as "Montant",
    case owner
        when 'shared'   then '✓ Commun — vu par les deux'
        when 'partnerA' then '✗ Rary seul'
        when 'partnerB' then '✗ Avotsoa seul'
    end           as "Visibilité",
    label         as "Libellé",
    created_at    as "Saisi le"
from (
    select 'revenu'        as type, date, amount, owner, label, created_at
      from public.incomes  where deleted_at is null
    union all
    select 'dépense',           date, amount, owner, label, created_at
      from public.expenses where deleted_at is null
    union all
    -- `date` porte l'échéance sur cette table : il n'existe pas de `due_date`.
    select 'facture',           date, amount, owner, label, created_at
      from public.bills    where deleted_at is null
    union all
    select 'épargne',           date, amount, owner, null, created_at
      from public.savings_contributions where deleted_at is null
) t
order by created_at desc
limit 25;


-- =====================================================================
--  RÉPARATION (facultatif) — rendre commun ce qui aurait dû l'être.
--
--  Décommentez UNIQUEMENT après avoir lu le résultat de la requête 4,
--  et ajustez la date. Cette opération est irréversible.
-- =====================================================================

-- update public.incomes
--    set owner = 'shared'
--  where created_at::date >= '2026-07-26'
--    and owner <> 'shared';
