# Budget Couple

Application web de gestion de budget pour un couple : chaque partenaire dispose de son propre
compte et de ses données privées, tout en partageant un espace commun dont les modifications se
reflètent chez l'autre en quasi temps réel.

Interface 100 % en français, thème clair/sombre, responsive.

---

## Sommaire

- [Budget Couple](#budget-couple)
  - [Sommaire](#sommaire)
  - [Stack technique](#stack-technique)
  - [Installation](#installation)
  - [Configuration Supabase](#configuration-supabase)
    - [1. Créer le projet](#1-créer-le-projet)
    - [2. Renseigner les variables d'environnement](#2-renseigner-les-variables-denvironnement)
    - [3. Exécuter les migrations](#3-exécuter-les-migrations)
    - [4. Désactiver la confirmation d'e-mail](#4-désactiver-la-confirmation-de-mail)
  - [Lancer le projet](#lancer-le-projet)
  - [Premier parcours](#premier-parcours)
  - [Vérifier la synchronisation et la confidentialité](#vérifier-la-synchronisation-et-la-confidentialité)
  - [Arborescence](#arborescence)
  - [Modèle de données](#modèle-de-données)
    - [Trois choix de conception à connaître](#trois-choix-de-conception-à-connaître)
  - [Permissions](#permissions)
  - [Conventions de calcul](#conventions-de-calcul)
    - [Alertes](#alertes)
  - [Accessibilité et data-viz](#accessibilité-et-data-viz)
  - [Scripts](#scripts)
  - [État de vérification](#état-de-vérification)

---

## Stack technique

| Domaine | Choix |
|---|---|
| Build | Vite 8 · React 19 · TypeScript en mode strict |
| Styles | Tailwind CSS v4 (configuration CSS-first, thème par variables) |
| État serveur | TanStack Query v5 |
| Formulaires | react-hook-form + zod |
| Graphiques | Recharts |
| Routage | react-router v7 |
| Base, auth, temps réel | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Tests | Vitest sur la logique financière |

**Pourquoi une SPA Vite plutôt que Next.js ?** Supabase fournit l'API, l'authentification et le
temps réel directement au navigateur. Il n'y a aucun secret serveur à protéger ni rendu serveur à
produire : Next.js n'apporterait ici que de la complexité SSR sans contrepartie.

---

## Installation

Prérequis : **Node.js 20+** et npm.

```bash
npm install
```

---

## Configuration Supabase

L'application ne peut pas démarrer sans un projet Supabase. Si les variables manquent, un écran
d'installation reprend ces étapes.

### 1. Créer le projet

Sur `https://supabase.com/dashboard`, créez un projet — l'offre gratuite suffit largement.

### 2. Renseigner les variables d'environnement

```bash
cp .env.example .env      # PowerShell : Copy-Item .env.example .env
```

Puis remplissez `.env` avec les valeurs de **Project Settings → API** :

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> La clé `anon` est publique par conception : c'est la RLS qui protège les données, pas le secret
> de la clé. N'utilisez **jamais** la clé `service_role` ici — elle contourne toutes les policies.

### 3. Exécuter les migrations

Dans le **SQL Editor** de Supabase, exécutez les quatre fichiers **dans l'ordre** :

| Fichier | Contenu |
|---|---|
| `supabase/migrations/0001_schema.sql` | Types, tables, triggers, index |
| `supabase/migrations/0002_rls.sql` | Row Level Security, policies, publication temps réel |
| `supabase/migrations/0003_functions.sql` | Création / rattachement de foyer, vue de progression |
| `supabase/migrations/0004_demo_data.sql` | Fonction de chargement des données de démonstration |

Les scripts sont ré-exécutables sans erreur.

### 4. Désactiver la confirmation d'e-mail

Dans **Authentication → Sign In / Providers → Email**, désactivez **Confirm email**.

> Sans cela, les comptes de test restent bloqués en attente d'un e-mail que vous ne recevrez pas.
> C'est l'obstacle le plus courant lors d'une première mise en route.

---

## Lancer le projet

```bash
npm run dev
```

L'application démarre sur <http://localhost:5173>.

---

## Premier parcours

1. **Créer le compte du partenaire A** → *Créer un compte*.
2. **Créer le foyer** → notez le **code d'invitation à 6 caractères** affiché ensuite.
3. **Charger les données de démonstration** → *Paramètres → Charger les données de démonstration*.
   Huit mois d'historique réaliste sont générés : revenus, dépenses, factures, épargne,
   investissements, budgets de catégorie — répartis entre les deux partenaires.
4. **Créer le compte du partenaire B** dans une **fenêtre de navigation privée** (ou un autre
   navigateur), puis *Rejoindre* avec le code.

Les lignes attribuées au partenaire B existent dès l'étape 3, avant même son inscription : elles
lui deviennent visibles à son arrivée, et ses lignes privées restent invisibles au partenaire A.

---

## Vérifier la synchronisation et la confidentialité

C'est le test décisif : il valide d'un coup le temps réel, la séparation privé/partagé et le
multi-utilisateur. Placez les deux fenêtres côte à côte, connectées chacune à un partenaire.

| Action dans la fenêtre A | Résultat attendu dans la fenêtre B |
|---|---|
| Ajouter une dépense avec propriétaire **« Commun »** | Elle apparaît **sans rechargement**, avec une notification « Dépenses mis à jour par votre partenaire » |
| Ajouter une dépense avec propriétaire **privé** | **Rien** n'apparaît — la ligne n'est jamais transmise au navigateur de B |
| Modifier le montant d'une dépense commune | Le montant et tous les totaux se mettent à jour chez B |
| Marquer une facture commune comme payée | Le statut et les alertes changent chez B |

L'indicateur de connexion temps réel se trouve dans la barre supérieure, à gauche de la cloche
d'alertes.

**Pourquoi c'est une vraie séparation, pas un masquage d'interface.** Les policies RLS de
`0002_rls.sql` filtrent au niveau de PostgreSQL. Une ligne privée du partenaire A n'est renvoyée
ni par l'API REST, ni par le canal temps réel de B — même en interrogeant l'API directement avec
son jeton. Le sélecteur de périmètre de l'en-tête (*Couple / Moi / Commun*) n'est qu'un filtre de
confort par-dessus ce que le serveur a déjà autorisé.

---

## Arborescence

```
budget/
├─ index.html
├─ vite.config.ts · tsconfig.json · package.json
├─ .env.example                        ← à copier en .env
├─ supabase/
│  └─ migrations/
│     ├─ 0001_schema.sql               tables, types, triggers, index
│     ├─ 0002_rls.sql                  RLS, policies, publication realtime
│     ├─ 0003_functions.sql            create/join household, vue progression
│     └─ 0004_demo_data.sql            RPC seed_demo_data()
└─ src/
   ├─ main.tsx · App.tsx               point d'entrée et routage
   ├─ lib/
   │  ├─ supabase.ts                   client + traduction des erreurs
   │  ├─ format.ts                     euros et dates fr-FR
   │  ├─ constants.ts                  libellés, catégories, seuils d'alerte
   │  ├─ cn.ts
   │  └─ finance/
   │     ├─ calculations.ts            ← toute la logique métier (pure)
   │     ├─ alerts.ts                  ← règles d'alerte (pures)
   │     ├─ types.ts
   │     └─ *.test.ts                  61 tests Vitest
   ├─ types/database.ts                reflet TypeScript du schéma
   ├─ contexts/                        Auth · Household · Scope · Theme
   ├─ hooks/
   │  ├─ useFinanceData.ts             chargement + dérivations
   │  ├─ useFinanceMutations.ts        CRUD générique + toasts
   │  ├─ useRealtimeSync.ts            canal Supabase → invalidation du cache
   │  └─ useAuth · useHousehold · useScope · useTheme
   ├─ components/
   │  ├─ ui/                           Button, Card, Field, DataTable, Dialog,
   │  │                                Badge, KpiCard, ProgressBar, States…
   │  ├─ layout/                       AppShell, MonthPicker, ScopeSwitcher, AlertCenter
   │  ├─ charts/                       ChartCard (+ vue tableau), FinanceCharts, primitives
   │  └─ forms/                        un formulaire zod + RHF par entité
   └─ pages/
      ├─ auth/                         Login · Signup · Onboarding (créer/rejoindre)
      ├─ SetupPage.tsx                 écran affiché si .env manque
      ├─ DashboardPage · IncomesPage · ExpensesPage · BillsPage
      ├─ SavingsPage · InvestmentsPage
      └─ SummaryPage · ReportsPage · SettingsPage
```

---

## Modèle de données

**Identité et foyer** — `profiles`, `households` (nom + code d'invitation), `household_members`
(rôle + place `partnerA`/`partnerB`, deux membres maximum par foyer).

**Flux financiers** — `incomes`, `expenses`, `bills`, `savings_goals`, `savings_contributions`,
`investments`, `category_budgets`, plus `monthly_snapshots` et `notifications`.

Toutes les tables financières partagent la même ossature : `household_id`, `created_by`, `owner`,
`note`, `created_at`, `updated_at`, `deleted_at` (suppression logique).

### Trois choix de conception à connaître

**`owner_type` est une colonne générée, pas un champ stocké.**

```sql
owner      text not null check (owner in ('partnerA','partnerB','shared')),
owner_type text generated always as
             (case when owner = 'shared' then 'shared' else 'private' end) stored
```

Les deux champs demandés existent et sont indexables, mais avec une seule source de vérité :
il est impossible de les faire diverger. `year` et `month` suivent le même principe à partir
de `date`.

**Le montant courant d'un objectif d'épargne n'est pas stocké.** C'est la somme de ses
mouvements (`savings_contributions`), exposée par la vue `savings_goals_with_progress`. Outre
l'absence de risque de divergence, cela fournit l'historique sans lequel le graphique d'évolution
de l'épargne serait impossible.

**`monthly_snapshots` est par membre, pas par foyer.** Un agrégat unique pour le couple
mélangerait les données privées des deux partenaires et les laisserait fuiter à travers les
totaux ; la clé unique porte donc `(household_id, user_id, year, month)`, et sa policy RLS est
`user_id = auth.uid()`.

> **La table est créée mais pas encore utilisée par l'application.** Les synthèses sont
> aujourd'hui recalculées à la volée dans `lib/finance/calculations.ts` à partir des données
> déjà chargées — sur un an d'historique, c'est instantané et toujours à jour. La table est
> prête pour le jour où l'on voudra archiver des mois clôturés ou couvrir plusieurs années.

---

## Permissions

Trois fonctions `security definer` — `is_household_member`, `my_partner_slot`, `my_role` — servent
de socle aux policies. Elles sont indispensables : une policy sur `expenses` qui interrogerait
directement `household_members` déclencherait la RLS de cette table, dont la policy interroge
elle-même `household_members` → récursion infinie.

| Opération | Condition |
|---|---|
| `SELECT` | membre du foyer **ET** (ligne `shared` **OU** ligne de ma place) |
| `INSERT` | idem **ET** rôle `owner`/`editor` **ET** `created_by = auth.uid()` |
| `UPDATE` / `DELETE` | idem `SELECT` **ET** rôle `owner`/`editor` |

**Rôles** — `owner` gère le foyer, les rôles et le code d'invitation · `editor` ajoute et modifie
· `viewer` consulte uniquement. Le rôle se change dans *Paramètres → Membres et rôles*.

---

## Conventions de calcul

Ces conventions valent partout dans l'application ; elles sont rappelées en bas de la page
Rapports.

- **Dépenses et factures sont deux flux distincts.** Une charge récurrente vit dans `bills`, une
  transaction ponctuelle dans `expenses`. Les additionner donne les **sorties totales** ; les
  confondre les compterait deux fois.
- **Reste à vivre = revenus − dépenses − factures − épargne − investissements.**
- **Taux d'épargne = épargne nette / revenus** (les retraits sont déduits).
- **Ratio de charges fixes = (dépenses fixes + factures) / revenus.**
- **La contribution suit le payeur réel** (`paid_by`), pas le propriétaire de la ligne : une
  dépense commune réglée par une seule personne lui est imputée. Les factures communes sont
  réparties à parts égales.
- **La moyenne journalière** se calcule sur les jours *écoulés* du mois — sinon elle serait
  artificiellement basse en début de mois.
- **Une dépense inhabituelle** dépasse trois fois la dépense *médiane* du mois. La médiane plutôt
  que la moyenne, sinon une grosse dépense relèverait le seuil et se masquerait elle-même.

L'ensemble est couvert par 61 tests (`npm run test`).

### Alertes

Cinq règles sont évaluées à chaque chargement, sur la période et le périmètre affichés :
dépassement d'un budget de catégorie (et avertissement dès 85 %), facture en retard ou échéance
sous 7 jours, décrochage de l'épargne face au mois précédent, objectif d'épargne hors trajectoire,
solde de fin de mois faible ou négatif.

Chaque alerte porte une clé de déduplication stable qui identifie **le fait signalé**, pas
l'instant de l'évaluation. C'est ce qui permet de l'historiser dans `notifications` sans créer de
doublon à chaque visite, et de la masquer durablement depuis la cloche de la barre supérieure.
Les notifications sont strictement personnelles : masquer une alerte chez soi ne la masque pas
chez son partenaire.

---

## Accessibilité et data-viz

- **Palette validée par calcul**, pas à l'œil : les huit teintes catégorielles passent les
  contrôles de bande de luminosité, de chroma, de séparation sous déficience de vision des
  couleurs (ΔE ≥ 8) et de contraste — dans les deux thèmes. Le thème sombre utilise les mêmes
  teintes redosées pour la surface sombre, jamais une inversion automatique.
- **La couleur suit l'entité, jamais son rang.** Filtrer une série ne repeint pas les autres.
- **Chaque graphique a un équivalent tabulaire** (bouton *Tableau*) : aucune valeur n'est
  accessible uniquement par la couleur ou l'infobulle.
- **Une légende est présente dès deux séries** ; les statuts associent toujours une icône à la
  couleur.
- Le thème respecte `prefers-color-scheme` au premier rendu, et `prefers-reduced-motion` désactive
  les animations.

---

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Typecheck strict puis build de production |
| `npm run preview` | Sert le build de production |
| `npm run typecheck` | `tsc --noEmit` seul |
| `npm run test` | Tests Vitest |
| `npm run test:watch` | Tests en mode veille |

---

## État de vérification

Vérifié sur cette machine : `tsc --noEmit` sans erreur en mode strict, **61 tests au vert**, build
de production réussi (3 chunks : application 170 ko gzip, graphiques 114 ko, Supabase 53 ko),
serveur de développement démarrant et servant l'application.

**Non vérifié ici, faute de projet Supabase** : le parcours connecté — authentification réelle,
policies RLS, diffusion temps réel, chargement des données de démonstration. La recette de la
section [Vérifier la synchronisation et la confidentialité](#vérifier-la-synchronisation-et-la-confidentialité)
couvre ces points une fois vos identifiants renseignés.



mdp :1324Hasi24Avo ana ty 
rehefa manao hebergement ndry de manao rejoindre fa tsy creer de ty ny code ampidirina : CDGBTY 

ty ny comptndry ( antsarary.ranarison@gmail.com ; mdp:12345678)

vola miditra , depense , ny tanjona tratrarina , 
