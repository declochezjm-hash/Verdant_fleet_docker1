# Audit applicatif Verdura

> **Document de référence** pour la conception d'un agent IA conversationnel sur mesure.  
> **Date :** 19 août 2026  
> **Périmètre :** code source (`src/`), schéma Supabase/PostgreSQL, politiques RLS, routes TanStack Router.

---

## 1. Synthèse exécutive

**Verdura** est une application full-stack de gestion d'espaces verts (planning, stocks phytosanitaires, parc matériel, comptabilité analytique). Elle repose sur :

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TanStack Router/Start, Tailwind |
| Backend | Supabase (Auth, PostgreSQL, Storage, RPC) |
| Auth | JWT PKCE, table `user_roles`, RLS PostgreSQL |
| Cartographie | Mapbox GL |

**Modèle organisationnel :** mono-organisation, sans `org_id` ni multi-tenant UUID. Le découpage opérationnel passe par des **équipes nommées** (`teams.name` ↔ `profiles.team` / `tasks.team` / `equipment.team` en texte libre).

**Point clé pour l'agent IA :** une table `jarvis_messages` existe déjà dans le schéma cloud (historique conversationnel par utilisateur, RLS propre). Aucun module « patrimoine arboré » ni entité « site/parc » structurée n'est implémenté — l'unité métier centrale est le **chantier** (`tasks`).

---

## 2. Structure des routes et pages

### 2.1 Arbre de navigation (TanStack Router)

```
__root.tsx  (Sidebar + AuthProvider + RoleSwitcher)
├── /                     → Hub par rôle (agent / admin / coordinator)
├── /planning             → PlanningSupabaseView
├── /carte                → CarteSupabaseView (Mapbox)
├── /stocks               → StocksView (produits + registre phyto)
├── /materiel             → MaterielView (parc + maintenance)
├── /coordinator          → CoordinatorView (CRUD chantiers)
├── /analytics            → AdminAnalytics (marges, coûts, export CSV)
├── /anomalies            → AnomaliesView (pannes matériel)
├── /settings             → SettingsView (équipes, parc, tiers, catalogue)
├── /auth                 → Connexion / inscription
└── /auth/callback        → Callback OAuth / reset password
```

**Routes absentes ou incomplètes :**
- `/reset-password` — composant `ResetPasswordView` existant, route non créée
- `/villes-fleuries` — table BDD présente, UI non routée
- `/analytique` — URL legacy dans `app-sidebar.tsx` (non utilisée) ; route réelle = `/analytics`

### 2.2 Domaines métier par page

| Domaine | Route(s) | Composant principal | Entités manipulées |
|---------|----------|---------------------|-------------------|
| **Tableau de bord** | `/` | `AgentSupabaseView` / `CoordinatorDashboard` / `AdminAnalytics` | `tasks`, `profiles`, agrégats financiers |
| **Planning interventions** | `/planning` | `PlanningSupabaseView` | `tasks`, `task_assignments`, `teams` |
| **Carte / géolocalisation** | `/carte` | `CarteSupabaseView` | `tasks` (lat, lng, address) |
| **Gestion chantiers** | `/coordinator` | `CoordinatorView` | `tasks`, `clients` (texte), statuts, priorités |
| **Budgets / analytique** | `/analytics`, `/` (admin) | `AdminAnalytics` | `tasks.budget`, `labor_cost`, marges équipes |
| **Stocks phytosanitaires** | `/stocks` | `StocksView` | `products`, `task_products`, `clients` |
| **Parc matériel** | `/materiel` | `MaterielView` | `equipment`, `maintenance_logs`, `v_equipment_alerts` |
| **Anomalies / pannes** | `/anomalies` | `AnomaliesView` | `anomalies`, `equipment` |
| **Paramétrage** | `/settings` | `SettingsView` | `teams`, `profiles`, `equipment`, `products`, `suppliers`, `clients` |
| **Auth** | `/auth`, `/auth/callback` | inline | `profiles`, `user_roles` |

### 2.3 Concepts espaces verts — présence dans le code

| Concept métier | Statut | Représentation actuelle |
|----------------|--------|-------------------------|
| Chantiers / interventions | ✅ Implémenté | Table `tasks` |
| Sites / clients | ⚠️ Partiel | Champ `tasks.client` (texte) + table `clients` (UI settings/stocks, schéma non versionné) |
| Parcs / espaces verts | ❌ Absent | Mention mock « Parc de la Tête d'Or » uniquement |
| Patrimoine arboré | ❌ Absent | Aucune table, route ou composant |
| Budgets d'entretien | ⚠️ Partiel | `tasks.budget` par chantier ; overheads par équipe dans `teams` |
| Villes fleuries | ⚠️ Schéma seul | Table `villes_fleuries_evaluations`, pas de route UI |
| Météo / contraintes terrain | ✅ Implémenté | `requires_dry_weather`, `actual_weather`, `weather_alert_status` |

### 2.4 Sidebar — filtrage par rôle

| Entrée menu | Route | Agent | Coordinator | Admin |
|-------------|-------|:-----:|:-----------:|:-----:|
| Tableau de bord | `/` | — | ✅ | ✅ |
| Gestion chantiers | `/coordinator` | — | ✅ | ✅ |
| Planning | `/planning` | ✅ | ✅ | ✅ |
| Carte | `/carte` | ✅ | ✅ | ✅ |
| Matériel | `/materiel` | — | ✅ | ✅ |
| Anomalies | `/anomalies` | — | ✅ | ✅ |
| Stocks | `/stocks` | — | ✅ | ✅ |
| Analytique | `/analytics` | — | ✅ | ✅ |
| Paramètres | `/settings` | — | ✅ | ✅ |

> **Attention :** la sidebar filtre l'affichage, mais **aucune garde `beforeLoad`** n'empêche l'accès direct par URL. La protection réelle repose sur RLS Supabase.

---

## 3. Entités clés et identifiants

### 3.1 Modèle conceptuel

```
auth.users
    │
    ├── profiles (id = user_id, name, team, hourly_rate, email, is_blocked)
    ├── user_roles (user_id, role: app_role)
    └── jarvis_messages (user_id, role, content, metadata)
    
teams (id, name UNIQUE, color, overhead_*, margin_pct, tax_pct)
    │  ← lié par NOM (texte), pas par FK
    ├── profiles.team
    ├── tasks.team
    └── equipment.team

tasks (id, project_number, title, client, address, lat/lng, budget, status, priority, …)
    ├── task_assignments (task_id, user_id)
    ├── task_equipment (task_id, equipment_id)
    ├── task_products (id, task_id, product_id, quantity, lot_number, dose_per_m2)
    └── anomalies (task_id, equipment_id, reported_by)

equipment (id, internal_id, name, type, status, hours_used, assigned_to, team)
    └── maintenance_logs (equipment_id, type, cost)

products (id, name, amm_number, category, stock, threshold, price_per_unit)
    └── task_products

suppliers → purchase_orders → purchase_order_items → invoices
clients (id, name, email, phone) — utilisé en UI, schéma non migré
villes_fleuries_evaluations (commune_name, visit_date, evaluation_criteria JSONB)
eco_wallets (user_id, eco_tokens, co2_saved_kg)
```

### 3.2 Tableau des identifiants

| Entité | Table | PK | Identifiants métier | Champs de regroupement |
|--------|-------|----|---------------------|------------------------|
| Utilisateur | `profiles` | `id` (UUID = `auth.users.id`) | `email` (UNIQUE) | `team` (texte) |
| Rôle | `user_roles` | `id` | — | `user_id`, `role` |
| Équipe | `teams` | `id` | `name` (UNIQUE) | — |
| Chantier | `tasks` | `id` | **`project_number`** (ex. C2024-01) | `team`, `client`, `status`, `priority` |
| Assignation | `task_assignments` | (`task_id`, `user_id`) | — | — |
| Matériel | `equipment` | `id` | **`internal_id`** (ex. 001) | `team`, `assigned_to` |
| Produit | `products` | `id` | **`amm_number`** (registre phyto) | `category` (Engrais/Phyto/Semences) |
| Consommation chantier | `task_products` | `id` | **`lot_number`** | `task_id`, `product_id` |
| Anomalie | `anomalies` | `id` | — | `equipment_id`, `task_id`, `resolved` |
| Client / tiers | `clients` | `id` | `name` | — |
| Fournisseur | `suppliers` | `id` | `name` | — |
| Commande achat | `purchase_orders` | `id` | — | `supplier_id`, `status` |
| Facture achat | `invoices` | `id` | **`invoice_number`** | `order_id` |
| Message IA | `jarvis_messages` | `id` | — | `user_id` |
| Évaluation VF | `villes_fleuries_evaluations` | `id` | `commune_name` | `visit_date` |

### 3.3 Enums PostgreSQL

| Enum | Valeurs |
|------|---------|
| `app_role` | `agent`, `coordinator`, `admin` |
| `task_status` | `planifie`, `en_cours`, `termine`, `annule` |
| `equipment_status` | `OK`, `Maintenance requise`, `En panne` |
| `product_category` | `Engrais`, `Phyto`, `Semences` |
| `product_unit` | `L`, `Kg`, `Sac` |

**Priorités** (`tasks.priority`, `anomalies.priority`) : `normale`, `haute`, `urgente` (TEXT + CHECK, pas enum).

### 3.4 Fonctions RPC utiles pour l'agent

| Fonction | Usage |
|----------|-------|
| `has_role(user_id, role)` | Vérification RBAC |
| `is_assigned(task_id, user_id)` | Filtrage agent sur ses chantiers |
| `finish_task(...)` | Clôture atomique (coûts, stocks, signature) |
| `seed_demo_data()` | Peuplement démo |

### 3.5 Storage Supabase

| Bucket | Usage | Chemins typiques |
|--------|-------|------------------|
| `task-media` | Photos avant/après, signatures, pièces anomalies | URLs dans `tasks.photo_*_url`, `tasks.signature_url` |

---

## 4. Tables BDD candidates pour la lecture automatique par l'IA

Classification par **priorité** pour un agent conversationnel opérationnel.

### 4.1 Tier 1 — Lecture prioritaire (cœur métier)

Ces tables alimentent les questions les plus fréquentes en espaces verts.

| Table | Colonnes clés pour l'IA | Exemples de questions |
|-------|-------------------------|----------------------|
| **`tasks`** | `project_number`, `title`, `client`, `address`, `scheduled_at`, `status`, `priority`, `budget`, `labor_cost`, `team`, `notes` | « Quels chantiers sont prévus demain pour l'équipe Nord ? » |
| **`task_assignments`** | `task_id`, `user_id` | « Quelles missions sont assignées à Jean ? » |
| **`profiles`** | `id`, `name`, `team`, `hourly_rate`, `is_blocked` | « Qui compose l'équipe Sud ? » |
| **`teams`** | `name`, `color`, `margin_pct`, `overhead_*_pct` | « Quelle marge appliquer sur l'équipe Nord ? » |
| **`equipment`** | `internal_id`, `name`, `type`, `status`, `hours_used`, `team` | « Quels engins sont en panne ? » |
| **`v_equipment_alerts`** | `id`, `name` | « Y a-t-il des alertes maintenance ? » |
| **`products`** | `name`, `amm_number`, `category`, `stock`, `threshold` | « Quels produits phyto sont en rupture ? » |
| **`anomalies`** | `description`, `resolved`, `priority`, `equipment_id`, `task_id` | « Combien d'anomalies ouvertes cette semaine ? » |

### 4.2 Tier 2 — Lecture contextuelle (enrichissement)

| Table | Intérêt IA |
|-------|-----------|
| **`task_products`** | Traçabilité phyto (lot, dose/m²) — conformité réglementaire |
| **`task_equipment`** | Matériel mobilisé par chantier |
| **`maintenance_logs`** | Historique entretien, coûts |
| **`clients`** | Référentiel tiers (nom, contact) |
| **`suppliers`** | Fournisseurs |
| **`purchase_orders`** / **`purchase_order_items`** | Approvisionnements, statut commandes |
| **`invoices`** | Factures achats (`invoice_number`, montants) |

### 4.3 Tier 3 — Lecture spécialisée / future

| Table | Intérêt IA | Note |
|-------|-----------|------|
| **`jarvis_messages`** | Mémoire conversationnelle | **Infrastructure existante** — RLS `user_id = auth.uid()` |
| **`villes_fleuries_evaluations`** | Évaluations communes, critères JSONB | Pas d'UI ; agent pourrait être le premier consommateur |
| **`eco_wallets`** | Gamification CO₂ / tokens | Faible priorité métier |

### 4.4 Tables à exclure ou traiter avec prudence

| Ressource | Raison |
|-----------|--------|
| `auth.users` | Données sensibles ; passer par `profiles` |
| `user_roles` | Lecture admin uniquement ; l'agent doit hériter du rôle session |
| Storage binaire (`task-media`) | Préférer les URLs déjà stockées en colonnes texte |
| `clients` (écriture) | Schéma non versionné dans les migrations — vérifier existence en prod |

### 4.5 Requêtes types recommandées pour l'agent

```sql
-- Chantiers du jour par équipe
SELECT project_number, title, client, address, status, priority, scheduled_at
FROM tasks
WHERE team = $team AND scheduled_at::date = CURRENT_DATE
ORDER BY scheduled_at;

-- Alertes matériel
SELECT * FROM v_equipment_alerts;

-- Stocks sous seuil
SELECT name, category, stock, threshold, amm_number
FROM products WHERE stock <= threshold;

-- Performance financière (admin/coordinator)
SELECT client, SUM(budget) AS ca, SUM(labor_cost) AS cout, SUM(budget - labor_cost) AS marge
FROM tasks WHERE status = 'termine'
GROUP BY client;
```

---

## 5. Rôles utilisateurs et autorisations d'accès

### 5.1 Rôles codés vs rôles métier visés

Verdura n'implémente que **3 rôles techniques**. Les intitulés métier espaces verts doivent être **mappés** lors de la conception de l'agent :

| Rôle Verdura (`app_role`) | Équivalent métier probable | Stockage |
|---------------------------|----------------------------|----------|
| **`agent`** | Technicien / Jardinier / Agent terrain | `user_roles.role = 'agent'` |
| **`coordinator`** | Chef de secteur / Coordinateur d'équipes | `user_roles.role = 'coordinator'` |
| **`admin`** | Directeur espaces verts / Responsable administratif | `user_roles.role = 'admin'` |

**Absents du code :** Élu, Directeur général de collectivité, contrôleur phyto externe.

**Hiérarchie frontend :** `admin` > `coordinator` > `agent` (`primaryRole` dans `auth-context.tsx`).

**Multi-rôles :** la contrainte `UNIQUE(user_id, role)` permet plusieurs entrées ; seul le rôle le plus élevé pilote l'UI.

### 5.2 Matrice d'accès par rôle

#### Agent terrain

| Domaine | Lecture | Écriture | Filtrage données |
|---------|:-------:|:--------:|------------------|
| Ses chantiers assignés | ✅ | ✅ (démarrer, clôturer) | `is_assigned()` / `task_assignments` |
| Planning / carte | ✅ | ❌ (pas de drag-drop) | Tâches assignées uniquement (UI) |
| Stocks / produits | ✅ (inventaire global) | ✅ (consommation sur ses tâches) | `task_products` own tasks |
| Matériel | ✅ | ✅ (signaler panne → statut) | — |
| Anomalies | ✅ | ✅ (INSERT) | `reported_by = auth.uid()` |
| Analytics / settings | ❌ (UI) | ❌ | RLS bloque |
| Équipes / profils autres | ❌ | ❌ | — |

#### Coordinateur

| Domaine | Lecture | Écriture |
|---------|:-------:|:--------:|
| Tous les chantiers | ✅ | ✅ CRUD |
| Planning (réaffectation) | ✅ | ✅ |
| Équipes, agents, matériel | ✅ | ✅ |
| Stocks, fournisseurs, commandes | ✅ | ✅ |
| Anomalies | ✅ | ✅ (résolution) |
| Analytics | ✅ | ❌ (consultation) |
| Settings | ✅ | ✅ |
| Profils collaborateurs | ✅ | ✅ (invitation, blocage) |

#### Administrateur

| Domaine | Spécificité vs coordinator |
|---------|------------------------------|
| Dashboard `/` | Vue analytique financière par défaut |
| RLS PostgreSQL | **Quasi identique** à coordinator sur la plupart des tables |
| Storage | Suppression médias (policy admin) |
| Notifications | Ciblage OneSignal `role: admin` |

> **Écart important :** la différence admin/coordinator est surtout **UI et dashboard**, pas des policies RLS distinctes sur le cœur métier.

### 5.3 Politiques RLS — état cible vs cloud

| Table | Modèle migrations (cible) | État cloud observé |
|-------|----------------------------|-------------------|
| `tasks` | SELECT assigné OU coord/admin ; UPDATE agent assigné | **RLS désactivé** — accès ouvert |
| `equipment` | SELECT tous ; ALL coord/admin | **RLS désactivé** |
| `products` | SELECT tous ; ALL coord/admin | **RLS désactivé** |
| `jarvis_messages` | ALL own (`user_id = auth.uid()`) | ✅ Conforme |
| `profiles` | SELECT tous ; manage coord/admin | ✅ Partiellement |
| `villes_fleuries_evaluations` | ALL coord/admin | ✅ |

**Recommandation agent IA :** exécuter les requêtes **via le JWT de l'utilisateur connecté** (pas service role), pour hériter automatiquement du RLS — une fois les écarts cloud corrigés.

### 5.4 Flux d'authentification

```
/auth → signInWithPassword / signUp(metadata: name, team, role)
              ↓
       TRIGGER handle_new_user()
              ↓
       profiles + user_roles créés
              ↓
       Session JWT → loadProfile() → primaryRole
              ↓
       / (hub) ou redirect si is_blocked / sans rôle
```

**Risques identifiés pour l'agent :**
1. Inscription permet de choisir `admin` sans validation serveur
2. Pas de garde route globale — l'agent ne doit pas contourner RLS
3. `types.ts` généré **obsolète** (9 tables vs 18+) — régénérer avant intégration

---

## 6. Recommandations pour l'agent IA conversationnel

### 6.1 Architecture suggérée

```
Utilisateur (JWT Supabase)
        │
        ▼
┌─────────────────────┐
│  Agent conversationnel │
│  (LLM + outils)        │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
jarvis_messages   Requêtes SQL/RPC
(historique)      (via client Supabase user-scoped)
    │                   │
    └─────────┬─────────┘
              ▼
         PostgreSQL + RLS
```

### 6.2 Capacités par rôle (agent IA)

| Capacité | Agent | Coordinator | Admin |
|----------|:-----:|:-----------:|:-----:|
| « Mes missions aujourd'hui » | ✅ | ✅ | ✅ |
| « Planning équipe X cette semaine » | ❌ | ✅ | ✅ |
| « Stocks phyto en alerte » | ✅ (lecture) | ✅ | ✅ |
| « Marge par client ce trimestre » | ❌ | ✅ | ✅ |
| « Créer un chantier » | ❌ | ✅ (outil) | ✅ |
| « Clôturer ma mission » | ✅ (RPC `finish_task`) | ✅ | ✅ |
| « Évaluations villes fleuries » | ❌ | ✅ | ✅ |

### 6.3 Gaps à combler avant l'agent

| Gap | Impact | Action recommandée |
|-----|--------|-------------------|
| Pas de patrimoine arboré | Questions « arbre n° X » impossibles | Modéliser `trees` / `green_assets` ou enrichir `tasks` |
| Pas de site structuré | « Tous les chantiers du parc Y » approximatif | FK `site_id` ou normaliser `clients` |
| Table `clients` non migrée | Requêtes tiers fragiles | Ajouter migration officielle |
| RLS cloud désactivé sur `tasks` | Fuite données inter-équipes | Réactiver RLS en prod |
| `types.ts` obsolète | Erreurs typage agent/outils | `supabase gen types typescript` |
| Route villes fleuries absente | Données orphelines | Router UI ou exposer via agent seul |

### 6.4 Vocabulaire métier pour le prompt système

Termes à injecter dans le contexte LLM :

- **Chantier** = `tasks` (pas « ticket » ni « work order »)
- **Site** = lieu d'intervention (`address` + `client`), pas une entité BDD
- **Équipe** = `teams.name` (Nord, Sud, Coordination…)
- **N° chantier** = `project_number`
- **N° interne matériel** = `equipment.internal_id`
- **N° AMM** = `products.amm_number` (registre phytosanitaire)
- **Statuts chantier** : planifié → en cours → terminé / annulé

---

## 7. Fichiers sources de référence

| Domaine | Chemin |
|---------|--------|
| Routes | `src/routes/`, `src/routeTree.gen.ts` |
| Auth / rôles | `src/lib/auth-context.tsx`, `src/routes/auth.tsx` |
| Sidebar | `src/components/views/sidebar.tsx` |
| Types Supabase | `src/integrations/supabase/types.ts` |
| Schéma cloud | `supabase/.temp/cloud-schema.sql` |
| Migrations | `supabase/migrations/` |
| Schéma doc | `supabase_schema.sql` |
| Client Supabase | `src/integrations/supabase/client.ts` |

---

## 8. Annexe — Inventaire complet des tables

| # | Table | RLS (cloud) | Exposée UI |
|---|-------|:-----------:|:----------:|
| 1 | `profiles` | ✅ | ✅ |
| 2 | `user_roles` | ✅ | ✅ |
| 3 | `teams` | ✅ | ✅ |
| 4 | `tasks` | ❌ | ✅ |
| 5 | `task_assignments` | ✅ | ✅ |
| 6 | `task_equipment` | ✅ | ✅ |
| 7 | `task_products` | ✅ | ✅ |
| 8 | `equipment` | ❌ | ✅ |
| 9 | `maintenance_logs` | ✅ (sans policy) | ✅ |
| 10 | `products` | ❌ | ✅ |
| 11 | `anomalies` | ✅ | ✅ |
| 12 | `suppliers` | ✅ | ✅ |
| 13 | `purchase_orders` | ✅ | ⚠️ partiel |
| 14 | `purchase_order_items` | ✅ (sans policy) | ⚠️ partiel |
| 15 | `invoices` | ✅ | ⚠️ partiel |
| 16 | `clients` | ? | ✅ (schéma manquant) |
| 17 | `jarvis_messages` | ✅ | ❌ (futur agent) |
| 18 | `villes_fleuries_evaluations` | ✅ | ❌ |
| 19 | `eco_wallets` | ✅ (sans policy) | ❌ |
| — | `v_equipment_alerts` (vue) | — | ✅ |

---

*Document généré par analyse statique du dépôt Verdant Fleet Docker. Les écarts cloud/local doivent être validés sur l'environnement Supabase cible avant mise en production de l'agent.*
