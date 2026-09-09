-- =============================================================================
-- 0004 — Données de démonstration
--
-- Un seed.sql statique ne peut pas fonctionner ici : il ignore les UUID des
-- comptes, qui n'existent qu'après inscription. On expose donc une RPC que
-- l'utilisateur connecté déclenche depuis Paramètres → « Charger les données
-- de démonstration ». Elle remplit SON foyer, quel que soit l'ordre
-- d'inscription des deux partenaires.
--
-- Les lignes attribuées à partnerB sont créées même si le second partenaire
-- n'a pas encore rejoint : elles lui deviendront visibles à son arrivée, et
-- ses lignes privées resteront invisibles à partnerA — ce qui permet de
-- vérifier la RLS sur des données réelles.
-- =============================================================================

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

  -- Nombre de mois d'historique généré (mois courant inclus).
  c_months constant int := 8;

  v_month_start date;
  v_day         date;
  i             int;
  k             int;

  v_goal_apport  uuid;
  v_goal_voyage  uuid;
  v_goal_secu_a  uuid;
  v_goal_auto_b  uuid;

  v_inserted int := 0;
begin
  if v_user is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;

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

  -- ---------------------------------------------------------------------------
  -- Objectifs d'épargne
  -- ---------------------------------------------------------------------------
  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'shared', 'Apport immobilier', 30000, (current_date + interval '20 months')::date,
          'Objectif commun pour l''achat de la résidence principale')
  returning id into v_goal_apport;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'shared', 'Voyage au Japon', 6000, (current_date + interval '9 months')::date,
          'Trois semaines au printemps')
  returning id into v_goal_voyage;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'partnerA', 'Épargne de précaution', 5000, (current_date + interval '12 months')::date,
          'Trois mois de dépenses courantes')
  returning id into v_goal_secu_a;

  insert into public.savings_goals (household_id, created_by, owner, name, target_amount, target_date, note)
  values (v_household, v_user, 'partnerB', 'Nouvelle voiture', 8000, (current_date + interval '18 months')::date,
          'Remplacement du véhicule actuel')
  returning id into v_goal_auto_b;

  -- ---------------------------------------------------------------------------
  -- Budgets mensuels par catégorie (support des alertes de dépassement)
  -- ---------------------------------------------------------------------------
  insert into public.category_budgets (household_id, created_by, owner, category, monthly_limit)
  values
    (v_household, v_user, 'shared', 'Alimentation', 650),
    (v_household, v_user, 'shared', 'Restaurants',  200),
    (v_household, v_user, 'shared', 'Loisirs',      200),
    (v_household, v_user, 'shared', 'Shopping',     250),
    (v_household, v_user, 'shared', 'Transport',    240);

  -- ---------------------------------------------------------------------------
  -- Boucle mensuelle : du mois le plus ancien au mois courant.
  -- ---------------------------------------------------------------------------
  for i in reverse (c_months - 1)..0 loop
    v_month_start := (date_trunc('month', current_date) - make_interval(months => i))::date;

    -- ===== Revenus ===========================================================
    -- Salaires : légère progression au fil des mois pour que les courbes vivent.
    insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
    values (
      v_household, v_user, 'partnerA', v_month_start + 1,
      round((2420 + (c_months - 1 - i) * 12 + random() * 40)::numeric, 2),
      'salary', 'Salaire net'
    );

    insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
    values (
      v_household, v_user, 'partnerB', v_month_start + 2,
      round((2145 + (c_months - 1 - i) * 9 + random() * 35)::numeric, 2),
      'salary', 'Salaire net'
    );

    -- Revenus ponctuels : une prime et deux missions freelance sur la période.
    if i = 5 then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'partnerA', v_month_start + 14, 1150.00, 'bonus', 'Prime d''intéressement');
    end if;

    if i in (4, 1) then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'partnerB', v_month_start + 18,
              round((480 + random() * 260)::numeric, 2), 'freelance', 'Mission graphisme');
    end if;

    if i = 3 then
      insert into public.incomes (household_id, created_by, owner, date, amount, income_type, label)
      values (v_household, v_user, 'shared', v_month_start + 9, 620.00, 'rental', 'Loyer du studio');
    end if;

    -- ===== Factures récurrentes =============================================
    insert into public.bills (household_id, created_by, owner, date, amount, label, category, frequency, status)
    values
      (v_household, v_user, 'shared',   v_month_start + 4,  950.00, 'Loyer',                   'Logement',  'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 9,  round((88 + random() * 42)::numeric, 2), 'Électricité', 'Énergie', 'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 11, 39.99,  'Internet fibre',          'Télécom',   'monthly', 'pending'),
      (v_household, v_user, 'shared',   v_month_start + 14, 22.40,  'Assurance habitation',    'Assurance', 'monthly', 'pending'),
      (v_household, v_user, 'partnerA', v_month_start + 6,  48.90,  'Mutuelle santé',          'Santé',     'monthly', 'pending'),
      (v_household, v_user, 'partnerA', v_month_start + 12, 19.99,  'Forfait mobile',          'Télécom',   'monthly', 'pending'),
      (v_household, v_user, 'partnerB', v_month_start + 6,  45.50,  'Mutuelle santé',          'Santé',     'monthly', 'pending'),
      (v_household, v_user, 'partnerB', v_month_start + 12, 12.99,  'Forfait mobile',          'Télécom',   'monthly', 'pending');

    -- Taxe foncière annuelle : une seule occurrence sur la période.
    if i = 2 then
      insert into public.bills (household_id, created_by, owner, date, amount, label, category, frequency, status)
      values (v_household, v_user, 'shared', v_month_start + 15, 486.00, 'Assurance auto', 'Assurance', 'annual', 'pending');
    end if;

    -- ===== Dépenses partagées ===============================================
    -- Courses : une par semaine, réglées alternativement par chacun.
    for k in 0..3 loop
      v_day := v_month_start + (k * 7 + 2);
      if v_day <= current_date then
        insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
        values (v_household, v_user, 'shared', v_day,
                round((108 + random() * 58)::numeric, 2),
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
                round((34 + random() * 46)::numeric, 2),
                'Restaurants', 'Sortie', 'variable',
                (case when k % 2 = 0 then 'partnerB' else 'partnerA' end)::owner_slot,
                'Restaurant');
      end if;

      v_day := v_month_start + (k * 15 + 3);
      if v_day <= current_date then
        insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
        values (v_household, v_user, 'shared', v_day,
                round((52 + random() * 26)::numeric, 2),
                'Transport', 'Carburant', 'variable',
                (case when k % 2 = 0 then 'partnerA' else 'partnerB' end)::owner_slot,
                'Plein d''essence');
      end if;
    end loop;

    v_day := v_month_start + 17;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_day,
              round((28 + random() * 52)::numeric, 2),
              'Loisirs', 'Culture', 'variable', 'partnerB', 'Cinéma et sorties');
    end if;

    v_day := v_month_start + 21;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_day,
              round((45 + random() * 95)::numeric, 2),
              'Shopping', 'Maison', 'variable', 'partnerA', 'Équipement maison');
    end if;

    -- Dépense inhabituelle isolée : alimente la détection d'anomalie du Summary.
    if i = 4 then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_month_start + 19, 1290.00,
              'Logement', 'Électroménager', 'variable', 'partnerA', 'Remplacement du lave-linge');
    end if;

    if i = 6 then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values (v_household, v_user, 'shared', v_month_start + 8, 742.50,
              'Santé', 'Dentaire', 'variable', 'partnerB', 'Soins dentaires');
    end if;

    -- ===== Dépenses privées =================================================
    v_day := v_month_start + 5;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values
        (v_household, v_user, 'partnerA', v_day, 10.99, 'Abonnements', 'Musique', 'fixed', 'partnerA', 'Streaming musical'),
        (v_household, v_user, 'partnerA', v_day, 34.90, 'Loisirs', 'Sport', 'fixed', 'partnerA', 'Salle de sport'),
        (v_household, v_user, 'partnerB', v_day, 13.49, 'Abonnements', 'Vidéo', 'fixed', 'partnerB', 'Streaming vidéo');
    end if;

    v_day := v_month_start + 16;
    if v_day <= current_date then
      insert into public.expenses (household_id, created_by, owner, date, amount, category, subcategory, kind, paid_by, label)
      values
        (v_household, v_user, 'partnerA', v_day, round((22 + random() * 48)::numeric, 2),
         'Shopping', 'Vêtements', 'variable', 'partnerA', 'Achats personnels'),
        (v_household, v_user, 'partnerB', v_day, round((26 + random() * 55)::numeric, 2),
         'Shopping', 'Vêtements', 'variable', 'partnerB', 'Achats personnels');
    end if;

    -- ===== Épargne ==========================================================
    -- Un mois de retrait (i = 3) pour que la courbe ne soit pas monotone.
    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount, note)
    values (v_household, v_user, v_goal_apport, 'shared', v_month_start + 3,
            case when i = 3 then -400 else round((330 + random() * 90)::numeric, 2) end,
            case when i = 3 then 'Retrait exceptionnel' else null end);

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_voyage, 'shared', v_month_start + 3,
            round((140 + random() * 50)::numeric, 2));

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_secu_a, 'partnerA', v_month_start + 4,
            round((110 + random() * 40)::numeric, 2));

    insert into public.savings_contributions (household_id, created_by, goal_id, owner, date, amount)
    values (v_household, v_user, v_goal_auto_b, 'partnerB', v_month_start + 4,
            round((165 + random() * 45)::numeric, 2));

    -- ===== Investissements ==================================================
    -- Chaque ligne = un versement. La valeur courante applique un rendement
    -- croissant avec l'ancienneté, ce qui rend la courbe « investi vs valeur »
    -- lisible dès le premier affichage.
    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (
      v_household, v_user, 'shared', v_month_start + 7, 'ETF MSCI World (PEA)', 'stocks',
      300.00, round((300 * (1 + 0.006 * (c_months - i)))::numeric, 2)
    );

    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (
      v_household, v_user, 'shared', v_month_start + 7, 'Assurance-vie — fonds euros', 'life_insurance',
      200.00, round((200 * (1 + 0.0025 * (c_months - i)))::numeric, 2)
    );

    insert into public.investments
      (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
    values (
      v_household, v_user, 'partnerA', v_month_start + 10, 'Bitcoin (DCA)', 'crypto',
      100.00, round((100 * (1 + 0.021 * (c_months - i)))::numeric, 2)
    );

    if i % 3 = 0 then
      insert into public.investments
        (household_id, created_by, owner, date, label, investment_type, invested_amount, current_value)
      values (
        v_household, v_user, 'partnerB', v_month_start + 13, 'SCPI de rendement', 'real_estate',
        500.00, round((500 * (1 + 0.004 * (c_months - i)))::numeric, 2)
      );
    end if;
  end loop;

  -- ---------------------------------------------------------------------------
  -- Statuts des factures : passées = payées, sauf une en retard pour que le
  -- centre d'alertes ait quelque chose à montrer.
  -- ---------------------------------------------------------------------------
  update public.bills
     set status = 'paid'
   where bills.household_id = v_household
     and bills.date < date_trunc('month', current_date)::date;

  update public.bills
     set status = 'overdue'
   where bills.household_id = v_household
     and bills.date < current_date
     and bills.date >= date_trunc('month', current_date)::date
     and bills.label = 'Électricité';

  select count(*) into v_inserted from public.expenses where household_id = v_household;

  return format('Données de démonstration chargées : %s mois d''historique, %s dépenses.', c_months, v_inserted);
end;
$$;

grant execute on function public.seed_demo_data(boolean) to authenticated;
