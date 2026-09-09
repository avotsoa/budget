-- =============================================================================
-- 0007 — Passage à l'ariary malgache (MGA)
--
-- Deux volets :
--   1. la devise par défaut des foyers, et celle des foyers existants ;
--   2. les données de démonstration, ré-étalonnées.
--
-- Le volet 2 est indispensable : un salaire de « 2 420 » avait du sens en
-- euros, il n'en a aucun en ariary. Les montants ci-dessous correspondent à
-- un ménage urbain à Antananarivo — à ajuster librement, ce ne sont que des
-- données d'illustration.
--
-- Le schéma n'a pas besoin de changer : `numeric(12,2)` accepte jusqu'à
-- 9 999 999 999,99 Ar, très au-delà des besoins d'un budget familial.
-- =============================================================================

alter table public.households alter column currency set default 'MGA';
update public.households set currency = 'MGA' where currency = 'EUR';

-- -----------------------------------------------------------------------------
-- Générateur de données de démonstration, en ariary.
--
-- Rappel : les lignes attribuées à partnerB sont créées même si le second
-- partenaire n'a pas encore rejoint le foyer.
-- -----------------------------------------------------------------------------
create or replace function public.seed_demo_data(p_reset boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_household uuid;
  v_existing  int;

  c_months constant int := 8;

  v_month_start date;
  v_day         date;
  i             int;
  k             int;

  v_goal_apport uuid;
  v_goal_voyage uuid;
  v_goal_secu_a uuid;
  v_goal_auto_b uuid;

  v_inserted int := 0;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

  perform public.ensure_profile();

  select household_id into v_household
  from public.household_members where user_id = v_user;

  if v_household is null then
    raise exception 'Vous devez appartenir à un foyer' using errcode = 'P0001';
  end if;

  select count(*) into v_existing from public.expenses where household_id = v_household;

  if v_existing > 0 and not p_reset then
    raise exception 'Ce foyer contient déjà des données. Relancez avec la réinitialisation pour les remplacer.'
      using errcode = 'P0004';
  end if;

  if p_reset then
    delete from public.savings_contributions where household_id = v_household;
    delete from public.savings_goals         where household_id = v_household;
    delete from public.incomes               where household_id = v_household;
    delete from public.expenses              where household_id = v_household;
    delete from public.bills                 where household_id = v_household;
    delete from public.investments           where household_id = v_household;
    delete from public.category_budgets      where household_id = v_household;
    delete from public.monthly_snapshots     where household_id = v_household;
    delete from public.notifications         where household_id = v_household;
  end if;

  -- ===== Objectifs d'épargne ================================================
  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'shared', 'Apport terrain', 45000000, (current_date + interval '20 months')::date,
          'Objectif commun pour l''acquisition d''un terrain')
  returning id into v_goal_apport;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'shared', 'Voyage en famille', 8000000, (current_date + interval '9 months')::date,
          'Trois semaines pendant les vacances')
  returning id into v_goal_voyage;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'partnerA', 'Épargne de précaution', 4500000, (current_date + interval '12 months')::date,
          'Trois mois de dépenses courantes')
  returning id into v_goal_secu_a;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'partnerB', 'Véhicule', 15000000, (current_date + interval '18 months')::date,
          'Remplacement du véhicule actuel')
  returning id into v_goal_auto_b;

  -- ===== Budgets par catégorie ==============================================
  insert into public.category_budgets (household_id, created_by, owner, category, monthly_limit)
  values
    (v_household, v_user, 'shared', 'Alimentation', 550000),
    (v_household, v_user, 'shared', 'Restaurants',  200000),
    (v_household, v_user, 'shared', 'Loisirs',      150000),
    (v_household, v_user, 'shared', 'Shopping',     250000),
    (v_household, v_user, 'shared', 'Transport',    300000);

  -- ===== Boucle mensuelle ===================================================
  for i in reverse (c_months - 1)..0 loop
    v_month_start := (date_trunc('month', current_date) - make_interval(months => i))::date;

    -- Revenus : légère progression pour que les courbes vivent.
    insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
    values (v_household, v_user, 'partnerA', v_month_start + 1,
            round((1420000 + (c_months - 1 - i) * 8000 + random() * 30000)::numeric, 2),
            'salary', 'Salaire net');

    insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
    values (v_household, v_user, 'partnerB', v_month_start + 2,
            round((1150000 + (c_months - 1 - i) * 6000 + random() * 25000)::numeric, 2),
            'salary', 'Salaire net');

    if i = 5 then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'partnerA', v_month_start + 14, 750000, 'bonus', 'Prime annuelle');
    end if;

    if i in (4, 1) then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'partnerB', v_month_start + 18,
              round((320000 + random() * 180000)::numeric, 2), 'freelance', 'Mission graphisme');
    end if;

    if i = 3 then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'shared', v_month_start + 9, 400000, 'rental', 'Loyer perçu');
    end if;

    -- Factures récurrentes
    insert into public.bills (household_id, created_by, owner, date, amount, label, category, frequency, status)
    values
      (v_household, v_user, 'shared',   v_month_start + 4,  650000, 'Loyer',                'Logement',  'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 9,  round((75000 + random() * 45000)::numeric, 2), 'Électricité et eau', 'Énergie', 'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 11, 149000, 'Internet fibre',       'Télécom',   'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 14, 45000,  'Assurance habitation', 'Assurance', 'monthly', 'pending'),
      (v_household, v_user, 'partnerA', v_month_start + 6,  60000,  'Mutuelle santé',       'Santé',     'monthly', 'pending'),
      (v_household, v_user, 'partnerA', v_month_start + 12, 30000,  'Forfait mobile',       'Télécom',   'monthly', 'pending'),
      (v_household, v_user, 'partnerB', v_month_start + 6,  55000,  'Mutuelle santé',       'Santé',     'monthly', 'pending'),
      (v_household, v_user, 'partnerB', v_month_start + 12, 20000,  'Forfait mobile',       'Télécom',   'monthly', 'pending');

    if i = 2 then
      insert into public.bills (household_id, created_by, owner, date, amount, label, category, frequency, status)
      values (v_household, v_user, 'shared', v_month_start + 15, 480000, 'Assurance véhicule', 'Assurance', 'annual', 'pending');
    end if;

    -- Dépenses partagées — courses hebdomadaires, réglées à tour de rôle.
    for k in 0..3 loop
      v_day := v_month_start + (k * 7 + 2);
      if v_day <= current_date then
        insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
        values (v_household, v_user, 'shared', v_day,
                round((95000 + random() * 45000)::numeric, 2),
                'Alimentation', 'Courses', 'variable',
                (case when k % 2 = 0 then 'partnerA' else 'partnerB' end)::owner_slot,
                'Courses hebdomadaires');
      end if;
    end loop;

    for k in 0..1 loop
      v_day := v_month_start + (k * 13 + 6);
      if v_day <= current_date then
        insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
        values (v_household, v_user, 'shared', v_day,
                round((45000 + random() * 40000)::numeric, 2),
                'Restaurants', 'Sortie', 'variable',
                (case when k % 2 = 0 then 'partnerB' else 'partnerA' end)::owner_slot,
                'Restaurant');
      end if;

      v_day := v_month_start + (k * 15 + 3);
      if v_day <= current_date then
        insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
        values (v_household, v_user, 'shared', v_day,
                round((110000 + random() * 40000)::numeric, 2),
                'Transport', 'Carburant', 'variable',
                (case when k % 2 = 0 then 'partnerA' else 'partnerB' end)::owner_slot,
                'Plein de carburant');
      end if;
    end loop;

    v_day := v_month_start + 17;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_day,
              round((30000 + random() * 45000)::numeric, 2),
              'Loisirs', 'Culture', 'variable', 'partnerB', 'Sorties et loisirs');
    end if;

    v_day := v_month_start + 21;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_day,
              round((55000 + random() * 90000)::numeric, 2),
              'Shopping', 'Maison', 'variable', 'partnerA', 'Équipement maison');
    end if;

    -- Dépenses inhabituelles : alimentent la détection d'anomalie de la Synthèse.
    if i = 4 then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_month_start + 19, 1800000,
              'Logement', 'Électroménager', 'variable', 'partnerA', 'Remplacement du réfrigérateur');
    end if;

    if i = 6 then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_month_start + 8, 750000,
              'Santé', 'Dentaire', 'variable', 'partnerB', 'Soins dentaires');
    end if;

    -- Dépenses privées
    v_day := v_month_start + 5;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values
        (v_household, v_user, 'partnerA', v_day, 30000, 'Abonnements', 'Musique', 'fixed', 'partnerA', 'Streaming musical'),
        (v_household, v_user, 'partnerA', v_day, 90000, 'Loisirs', 'Sport', 'fixed', 'partnerA', 'Salle de sport'),
        (v_household, v_user, 'partnerB', v_day, 40000, 'Abonnements', 'Vidéo', 'fixed', 'partnerB', 'Streaming vidéo');
    end if;

    v_day := v_month_start + 16;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values
        (v_household, v_user, 'partnerA', v_day, round((40000 + random() * 70000)::numeric, 2),
         'Shopping', 'Vêtements', 'variable', 'partnerA', 'Achats personnels'),
        (v_household, v_user, 'partnerB', v_day, round((45000 + random() * 80000)::numeric, 2),
         'Shopping', 'Vêtements', 'variable', 'partnerB', 'Achats personnels');
    end if;

    -- Épargne — un retrait en i = 3 pour que la courbe ne soit pas monotone.
    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount, note)
    values (v_household, v_user, v_goal_apport, 'shared', v_month_start + 3,
            case when i = 3 then -600000 else round((420000 + random() * 90000)::numeric, 2) end,
            case when i = 3 then 'Retrait exceptionnel' else null end);

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_voyage, 'shared', v_month_start + 3,
            round((180000 + random() * 60000)::numeric, 2));

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_secu_a, 'partnerA', v_month_start + 4,
            round((140000 + random() * 50000)::numeric, 2));

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_auto_b, 'partnerB', v_month_start + 4,
            round((230000 + random() * 60000)::numeric, 2));

    -- Investissements : chaque ligne est un versement, valorisé selon son ancienneté.
    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (v_household, v_user, 'shared', v_month_start + 7, 'Actions — fonds diversifié', 'stocks',
            350000, round((350000 * (1 + 0.006 * (c_months - i)))::numeric, 2));

    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (v_household, v_user, 'shared', v_month_start + 7, 'Assurance-vie', 'life_insurance',
            250000, round((250000 * (1 + 0.0025 * (c_months - i)))::numeric, 2));

    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (v_household, v_user, 'partnerA', v_month_start + 10, 'Bitcoin (achats réguliers)', 'crypto',
            150000, round((150000 * (1 + 0.021 * (c_months - i)))::numeric, 2));

    if i % 3 = 0 then
      insert into public.investments
        (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
      values (v_household, v_user, 'partnerB', v_month_start + 13, 'Foncier locatif', 'real_estate',
              600000, round((600000 * (1 + 0.004 * (c_months - i)))::numeric, 2));
    end if;
  end loop;

  -- Statuts : les échéances passées sont réglées, sauf une laissée en retard
  -- pour que le centre d'alertes ait quelque chose à montrer.
  update public.bills
     set status = 'paid'
   where bills.household_id = v_household
     and bills.date < date_trunc('month', current_date)::date;

  update public.bills
     set status = 'overdue'
   where bills.household_id = v_household
     and bills.date < current_date
     and bills.date >= date_trunc('month', current_date)::date
     and bills.label = 'Électricité et eau';

  select count(*) into v_inserted from public.expenses where household_id = v_household;

  return format('Données de démonstration chargées : %s mois d''historique, %s dépenses.', c_months, v_inserted);
end;
$$;

revoke execute on function public.seed_demo_data(boolean) from public, anon;
grant  execute on function public.seed_demo_data(boolean) to authenticated;
