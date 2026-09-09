-- =====================================================================
--  EFFACEMENT DES DONNÉES — à coller dans Supabase > SQL Editor
--
--  ⚠  IRRÉVERSIBLE. Suppression définitive, pas une corbeille.
--
--  L'application marque normalement les lignes supprimées avec `deleted_at`
--  et les conserve. Ce script fait l'inverse : un vrai DELETE, pour repartir
--  d'une base réellement vide.
--
--  CE QUI EST EFFACÉ            CE QUI EST CONSERVÉ
--    revenus                      vos deux comptes et mots de passe
--    dépenses                     le foyer « budget vacance »
--    factures                     le code d'invitation R9KGWT
--    objectifs d'épargne          l'appartenance des deux partenaires
--    versements d'épargne         vos rôles (owner / editor)
--    investissements
--    budgets par catégorie
--    alertes et snapshots
--
--  Vous n'aurez donc PAS à recréer de compte ni à refaire la liaison.
-- =====================================================================


-- ---------------------------------------------------------------------
--  ÉTAPE 1 — APERÇU. Ne supprime rien. Exécutez d'abord ceci pour voir
--  exactement ce qui disparaîtra.
-- ---------------------------------------------------------------------
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


-- ---------------------------------------------------------------------
--  ÉTAPE 2 — SUPPRESSION.
--
--  N'exécutez ce bloc qu'après avoir lu le résultat de l'étape 1.
--  Le détail des lignes supprimées s'affiche dans l'onglet « Messages ».
-- ---------------------------------------------------------------------
do $$
declare
    v_code      text   := 'R9KGWT';   -- ← le foyer visé
    v_household uuid;
    v_table     text;
    v_deleted   bigint;
    v_total     bigint := 0;
begin
    select id into v_household
      from public.households
     where invite_code = upper(trim(v_code));

    if v_household is null then
        raise exception 'Aucun foyer ne porte le code « % »', v_code;
    end if;

    -- L'ordre est imposé par les clés étrangères : les versements référencent
    -- les objectifs, ils doivent partir en premier.
    foreach v_table in array array[
        'savings_contributions',
        'savings_goals',
        'incomes',
        'expenses',
        'bills',
        'investments',
        'category_budgets',
        'monthly_snapshots',
        'notifications'
    ]
    loop
        execute format('delete from public.%I where household_id = $1', v_table)
          using v_household;

        get diagnostics v_deleted = row_count;
        v_total := v_total + v_deleted;

        raise notice '% %', rpad(v_table, 24), v_deleted;
    end loop;

    raise notice '--------------------------------';
    raise notice 'TOTAL % ligne(s) supprimée(s).', v_total;
    raise notice 'Comptes, foyer et liaison conservés.';
end $$;


-- ---------------------------------------------------------------------
--  ÉTAPE 3 — VÉRIFICATION. Toutes les valeurs doivent être à 0.
--  Relancez simplement la requête de l'étape 1.
-- ---------------------------------------------------------------------
