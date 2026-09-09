Je veux que tu crées une application web complète de gestion de budget en couple, en français, prête à être exécutée localement.

<goal>
Construire une application moderne, claire et professionnelle pour suivre les finances mensuelles d’un couple.
Chaque partenaire doit pouvoir gérer ses propres données de son côté, tout en partageant automatiquement les données communes avec l’autre utilisateur.
L’application doit permettre de suivre :
- les revenus
- les dépenses
- les factures récurrentes
- l’épargne
- les investissements
- les résumés mensuels
- les statistiques et diagrammes
- les alertes de dépassement
- les détails par personne et pour le couple
</goal>

<users>
Il y a 2 utilisateurs :
- Partenaire A
- Partenaire B

Chacun doit avoir :
- son propre compte
- sa propre session
- ses données personnelles
- accès à un espace commun partagé

L’application doit aussi inclure un espace couple commun où les deux peuvent voir et modifier les éléments partagés.
</users>

<core_behavior>
Je veux que le fonctionnement soit collaboratif :
- chaque utilisateur peut se connecter séparément
- chacun peut ajouter ou modifier ses propres dépenses
- certaines données sont privées
- certaines données sont communes
- les données communes doivent être visibles par les deux utilisateurs
- toute modification sur une donnée commune doit être reflétée chez l’autre utilisateur
- prévoir une synchronisation en temps réel ou quasi temps réel
- chaque enregistrement doit avoir un champ owner : partnerA, partnerB ou shared
</core_behavior>

<tech_stack>
Utilise une stack simple, propre et moderne.
Choisis une architecture adaptée à Claude Code pour générer un projet propre et maintenable.

Stack souhaitée :
- Frontend : React + TypeScript
- UI : composants propres, modernes, responsive
- Styling : Tailwind CSS ou solution UI moderne cohérente
- Graphiques : Recharts ou Chart.js
- Backend / base de données : Supabase
- Authentification : Supabase Auth
- Base de données relationnelle claire
- Temps réel : utiliser les capacités realtime de Supabase si utile

Si tu juges qu’une autre stack est meilleure, explique brièvement pourquoi puis implémente une solution cohérente.
</tech_stack>

<product_requirements>
L’application doit contenir les modules suivants :

1. Dashboard principal
- KPI mensuels :
  - revenus totaux du couple
  - dépenses totales
  - épargne mensuelle
  - investissements mensuels
  - total factures
  - reste à vivre
  - taux d’épargne
  - solde de fin de mois
- comparaison avec le mois précédent
- cartes KPI claires
- graphiques de synthèse
- vue globale couple
- vue par partenaire

2. Revenus
- ajout, modification, suppression
- champs :
  - date
  - montant
  - type de revenu
  - propriétaire
  - note
- total individuel et total couple

3. Dépenses
- ajout, modification, suppression
- champs :
  - date
  - montant
  - catégorie
  - sous-catégorie
  - type : fixe ou variable
  - payé par
  - owner : privé ou partagé
  - note
- filtres :
  - mois
  - catégorie
  - partenaire
  - type
- tableau détaillé des transactions

4. Bills / factures
- factures récurrentes
- champs :
  - libellé
  - montant
  - date d’échéance
  - fréquence
  - statut : payé, à payer, en retard
  - propriétaire
  - note
- afficher les échéances du mois
- alertes sur les factures proches ou en retard

5. Épargne
- objectifs d’épargne multiples
- champs :
  - nom objectif
  - cible
  - montant actuel
  - owner
  - date cible
- progression en %
- reste à atteindre
- barres de progression

6. Investissements
- suivi des investissements
- types :
  - immobilier
  - actions
  - crypto
  - assurance-vie
  - épargne long terme
  - autres
- champs :
  - type
  - montant investi
  - valeur actuelle
  - date
  - propriétaire
  - note
- résumé mensuel et global

7. Summary mensuel
- résumé automatique du mois :
  - revenus
  - dépenses fixes
  - dépenses variables
  - bills
  - épargne
  - investissements
  - reste à vivre
  - top catégories de dépenses
  - dépenses inhabituelles
- petite zone d’analyse automatique du mois

8. Rapports et visualisations
- camembert dépenses par catégorie
- bar chart revenus vs dépenses par mois
- line chart évolution épargne
- line chart évolution investissements
- barre ou jauge taux d’épargne
- comparaison charges fixes vs variables
- répartition des contributions entre les deux partenaires

9. Détails avancés
- historique complet
- recherche
- filtres combinés
- vue “mes données”
- vue “données partagées”
- vue “budget couple”
- calcul de contribution de chacun
- pourcentage payé par chacun
- moyenne journalière de dépense
- catégorie la plus coûteuse
- économies potentielles

10. Alertes
- dépassement d’un budget catégorie
- facture en retard
- baisse de l’épargne
- objectif non atteint
- solde mensuel faible
</product_requirements>

<data_model>
Propose et implémente un modèle de données propre avec les entités suivantes au minimum :
- users
- couple_households
- household_members
- incomes
- expenses
- bills
- savings_goals
- investments
- monthly_snapshots
- notifications

Chaque donnée financière doit être liée :
- à un utilisateur créateur
- à un household
- à un owner_type : private ou shared

Prévois aussi :
- created_at
- updated_at
- month
- year
- soft delete si pertinent
</data_model>

<permissions>
Je veux une logique claire de permissions :
- un utilisateur voit ses données privées
- un utilisateur voit aussi les données partagées de son couple
- un utilisateur ne voit pas les données privées de l’autre
- les données shared sont modifiables selon permissions
- prévoir rôles :
  - owner
  - editor
  - viewer
</permissions>

<ui_ux>
L’interface doit être :
- 100 % en français
- moderne
- premium
- lisible
- responsive
- agréable sur desktop et mobile
- avec mode clair/sombre
- avec navigation latérale ou header clair

Sections prévues :
- Dashboard
- Revenus
- Dépenses
- Factures
- Épargne
- Investissements
- Summary
- Rapports
- Paramètres

Je veux :
- cartes KPI
- tableaux lisibles
- formulaires propres
- badges de statut
- graphiques élégants
- filtres visibles
- empty states soignés
- feedback visuel après ajout/modification/suppression
</ui_ux>

<sample_data>
Ajoute des données de démonstration réalistes pour deux partenaires.
Prévois plusieurs mois de données afin que les graphiques soient déjà parlants.
</sample_data>

<business_logic>
Implémente les calculs suivants :
- total revenus
- total dépenses
- total bills
- total épargne
- total investissements
- reste à vivre
- solde mensuel
- taux d’épargne
- variation vs mois précédent
- répartition par catégorie
- répartition par partenaire
- ratio charges fixes / revenus
- top dépenses du mois
</business_logic>

<delivery_rules>
Je ne veux pas seulement une maquette.
Je veux une vraie base de projet exploitable.

Fais les choses dans cet ordre :
1. Définis l’architecture du projet
2. Définis le schéma de données
3. Définis les écrans et composants
4. Implémente le frontend
5. Implémente la logique de données
6. Prépare l’authentification
7. Prépare la synchronisation des données partagées
8. Ajoute les graphiques
9. Ajoute les données de démonstration
10. Vérifie que le projet démarre correctement

Ensuite, donne :
- l’arborescence du projet
- les fichiers principaux
- les instructions d’installation
- les variables d’environnement nécessaires
- les commandes pour lancer le projet
</delivery_rules>

<constraints>
Contraintes importantes :
- code propre et maintenable
- composants réutilisables
- typage strict TypeScript
- noms de variables clairs
- éviter le code inutilement complexe
- ne pas faire une simple page statique
- ne pas faire une fausse synchronisation
- préparer une vraie logique multi-utilisateur
- bien séparer données privées et données partagées
- ajouter validation des formulaires
- ajouter états loading, empty, error
</constraints>

<definition_of_done>
Le projet est terminé seulement si :
- il y a une authentification
- il y a 2 utilisateurs simulables ou configurables
- il y a un espace couple partagé
- il y a des vues par partenaire et une vue globale
- les données communes peuvent être modifiées et reflétées chez l’autre
- les graphiques fonctionnent
- les totaux sont calculés automatiquement
- l’interface est en français
- le projet peut être lancé localement
- les instructions de setup sont claires
</definition_of_done>

<execution_mode>
Travaille comme un lead developer produit.
Prends des décisions raisonnables quand un détail manque.
Commence par proposer un plan d’implémentation court, puis génère le projet.
</execution_mode>

Ne code pas tout de suite. Commence par analyser la demande, proposer l’architecture technique, le schéma de base de données, les écrans, les composants et le plan d’implémentation. Une fois ce plan validé, génère ensuite le projet complet.





nous allons simplifier le projet :
- enleve les facture car on en a pas besoin pour le moment 