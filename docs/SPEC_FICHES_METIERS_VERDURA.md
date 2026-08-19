# Spécification — Fiches métiers Verdura pour l'agent IA

> **Version :** 1.0 — 19 août 2026  
> **Références :** `docs/AUDIT_APPLICATION_VERDURA.md`, `src/docs/profiles/*.md`  
> **Objectif :** Définir la matrice des 4 profils métiers, leur correspondance avec l'infrastructure Supabase et le guide d'injection dans le prompt système de l'agent conversationnel.

---

## 1. Vue d'ensemble

Verdura expose **3 rôles authentifiés** dans PostgreSQL (`app_role`) et **1 profil virtuel** (Élu / Partenaire) à simuler côté agent IA.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent IA Verdura (LLM)                        │
│  Prompt système = fiche métier + vocabulaire BDD + garde RLS    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   jarvis_messages    Supabase JWT       src/docs/profiles/
   (historique)       (RLS hérité)      (contexte métier)
```

---

## 2. Matrice des 4 rôles

### 2.1 Correspondance métier ↔ technique

| # | Fiche métier | Intitulé métier | Fichier | `app_role` BDD | Auth Verdura | Dashboard `/` |
|---|--------------|-----------------|---------|:--------------:|:------------:|---------------|
| 1 | **Admin** | Directeur Espaces Verts | `src/docs/profiles/admin.md` | `admin` | ✅ Session JWT | `AdminAnalytics` |
| 2 | **Coordinator** | Chef de Secteur | `src/docs/profiles/coordinator.md` | `coordinator` | ✅ Session JWT | `CoordinatorDashboard` |
| 3 | **Agent** | Jardinier / Technicien | `src/docs/profiles/agent.md` | `agent` | ✅ Session JWT | `AgentSupabaseView` |
| 4 | **Élu / Partenaire** | Élu, client, jury VF | `src/docs/profiles/elu-partenaire.md` | ❌ *virtuel* | ⚠️ À implémenter | — |

### 2.2 Hiérarchie & priorité UI

```
admin  >  coordinator  >  agent
         (primaryRole dans auth-context.tsx)
```

En cas de multi-rôles dans `user_roles`, seul le rôle le plus élevé pilote l'injection de fiche.

---

## 3. Matrice d'accès données (synthèse)

| Table / Vue | Admin | Coordinator | Agent | Élu (virtuel) |
|-------------|:-----:|:-----------:|:-----:|:-------------:|
| `tasks` | ✅ all | ✅ all | ✅ assignés | ✅ filtré `client` |
| `task_assignments` | ✅ | ✅ | ✅ own | ❌ |
| `task_products` | ✅ | ✅ | ✅ own tasks | ❌ |
| `equipment` / `v_equipment_alerts` | ✅ | ✅ | ✅ lecture + panne | ❌ |
| `products` | ✅ | ✅ | ✅ lecture | ❌ |
| `anomalies` | ✅ | ✅ | ✅ INSERT own | ❌ |
| `teams`, `profiles` | ✅ | ✅ | ❌ | ❌ |
| `villes_fleuries_evaluations` | ✅ | ✅ | ❌ | ✅ synthèse |
| `tasks.budget`, `labor_cost` | ✅ | ⚠️ | ❌ | ❌ |
| `purchase_orders`, `invoices` | ✅ | ✅ | ❌ | ❌ |
| `jarvis_messages` | ✅ own | ✅ own | ✅ own | ⚠️ futur |

**Légende :** ✅ autorisé · ⚠️ partiel · ❌ interdit

---

## 4. Matrice capacités agent IA

| Capacité conversationnelle | Admin | Coordinator | Agent | Élu |
|------------------------------|:-----:|:-----------:|:-----:|:---:|
| KPIs marge / coûts globaux | ✅ | ⚠️ | ❌ | ❌ |
| Planning toutes équipes | ✅ | ✅ | ❌ | ❌ |
| Mes missions du jour | ✅ | ✅ | ✅ | ❌ |
| Créer / modifier chantier | ✅ | ✅ | ❌ | ❌ |
| Clôturer mission (`finish_task`) | ✅ | ✅ | ✅ own | ❌ |
| Alertes `v_equipment_alerts` | ✅ | ✅ | ⚠️ own | ❌ |
| Stocks Phyto sous seuil | ✅ | ✅ | ✅ lecture | ❌ |
| Évaluations Villes Fleuries | ✅ | ✅ | ❌ | ✅ |
| Transparence chantiers commune | ⚠️ | ⚠️ | ❌ | ✅ |
| Signaler anomalie | ✅ | ✅ | ✅ | ❌ |

---

## 5. Tables BDD par profil (injection contexte)

### Tier 1 — injecter systématiquement selon le rôle

| Profil | Tables prioritaires |
|--------|---------------------|
| **admin** | `tasks`, `teams`, `equipment`, `v_equipment_alerts`, `products`, `anomalies`, `villes_fleuries_evaluations`, `purchase_orders` |
| **coordinator** | `tasks`, `task_assignments`, `task_equipment`, `teams`, `profiles`, `equipment`, `v_equipment_alerts`, `anomalies` |
| **agent** | `tasks`, `task_assignments`, `task_equipment`, `task_products`, `equipment`, `products`, `anomalies` |
| **elu-partenaire** | `tasks` (filtré), `villes_fleuries_evaluations`, `clients` |

### Tier 2 — injecter à la demande (tools)

`maintenance_logs`, `suppliers`, `invoices`, `eco_wallets`

---

## 6. Guide d'injection dans l'agent IA

### 6.1 Pipeline recommandé

```
1. Authentification Supabase → récupérer user_id + user_roles
2. Calculer primaryRole (admin > coordinator > agent)
3. Charger la fiche : src/docs/profiles/{role}.md
4. Injecter le vocabulaire BDD (section dédiée de chaque fiche)
5. Appliquer les filtres SQL selon la matrice §3
6. Persister l'échange dans jarvis_messages (user_id, role, content)
```

### 6.2 Template prompt système

```markdown
Tu es l'assistant IA Verdura pour la gestion des espaces verts.

## Profil utilisateur connecté
{contenu intégral de src/docs/profiles/{role}.md}

## Contraintes techniques
- Enum rôle session : {primaryRole} (user_roles.role)
- Identifiant utilisateur : {auth.uid()}
- Équipe : {profiles.team}
- Tu DOIS respecter le RLS Supabase — n'invente jamais de données.
- Vocabulaire : chantier = tasks, n° chantier = project_number (C202X-XX),
  engin = equipment.internal_id, AMM = products.amm_number.

## Interdictions pour ce profil
{liste extraite de la matrice §3 — colonnes ❌}

## Format de réponse
- Réponses concises, orientées action terrain ou pilotage selon le profil.
- Citer les identifiants métier (project_number, internal_id) quand pertinent.
- Utiliser des listes et tableaux pour les synthèses multi-chantiers.
```

### 6.3 Cas particulier — profil Élu / Partenaire

Le profil **`elu-partenaire`** n'a pas de `app_role`. Deux options :

| Option | Mécanisme | Recommandation |
|--------|-----------|----------------|
| **A — JWT claim** | `user_metadata.client_scope = ['Mairie de Lyon']` | Préféré |
| **B — Rôle simulé** | Prompt forcé sans auth, filtre manuel | Prototype uniquement |

Injection :

```markdown
## Profil utilisateur
{contenu de src/docs/profiles/elu-partenaire.md}

## Filtre obligatoire
- tasks.client IN ({allowed_clients})
- NE JAMAIS exposer : budget, labor_cost, hourly_rate, noms agents, anomalies détaillées
```

### 6.4 Sélection dynamique des tools SQL

| Tool | Admin | Coord | Agent | Élu |
|------|:-----:|:-----:|:-----:|:---:|
| `query_tasks` | all | all | `is_assigned()` | `client filter` |
| `query_equipment_alerts` | ✅ | ✅ | own team | ❌ |
| `query_products_stock` | ✅ | ✅ | read | ❌ |
| `query_anomalies` | ✅ | ✅ | own reports | ❌ |
| `query_vf_evaluations` | ✅ | ✅ | ❌ | ✅ |
| `finish_task` | ✅ | ✅ | own | ❌ |
| `create_anomaly` | ✅ | ✅ | ✅ | ❌ |

---

## 7. Index des fiches métiers

| Fichier | Rôle BDD | Pages Verdura | Exemples IA |
|---------|----------|---------------|:-----------:|
| [`admin.md`](../src/docs/profiles/admin.md) | `admin` | `/analytics`, `/settings` | 3 |
| [`coordinator.md`](../src/docs/profiles/coordinator.md) | `coordinator` | `/coordinator`, `/planning` | 3 |
| [`agent.md`](../src/docs/profiles/agent.md) | `agent` | `/planning`, `/carte` | 3 |
| [`elu-partenaire.md`](../src/docs/profiles/elu-partenaire.md) | *virtuel* | — (futur portail) | 3 |

---

## 8. Check-list intégration

### Avant mise en production agent

- [ ] Régénérer `src/integrations/supabase/types.ts` depuis le schéma cloud
- [ ] Réactiver RLS sur `tasks`, `equipment`, `products` en production
- [ ] Valider existence table `clients` en prod
- [ ] Implémenter chargement dynamique fiche selon `primaryRole`
- [ ] Tester 3 questions par profil (voir fiches § Exemples)
- [ ] Vérifier persistance `jarvis_messages` (RLS `user_id = auth.uid()`)
- [ ] Décider stratégie profil Élu (claim JWT vs rôle BDD)

### Validation fonctionnelle par profil

| Profil | Test | Résultat attendu |
|--------|------|------------------|
| Admin | Demande marge par client | Agrégat `budget - labor_cost`, cite `project_number` |
| Coordinator | Planning équipe demain | Liste `task_assignments` + `equipment.internal_id` |
| Agent | Mes missions | Uniquement chantiers assignés à `auth.uid()` |
| Élu | Avancement commune | Statuts sans coûts ni noms agents |

---

## 9. Écarts audit & actions correctives

| Écart | Impact fiches | Action |
|-------|---------------|--------|
| Pas de `app_role` partenaire | `elu-partenaire.md` = virtuel | Migration enum ou JWT claim |
| Pas de route `/villes-fleuries` | Élu dépend de l'agent | Agent = premier canal VF |
| RLS cloud partiel | Filtres prompt insuffisants seuls | Corriger RLS prod |
| `types.ts` obsolète | Tools IA mal typés | `supabase gen types` |

---

## 10. Références croisées

| Document | Contenu |
|----------|---------|
| `docs/AUDIT_APPLICATION_VERDURA.md` | Audit technique complet |
| `src/docs/profiles/admin.md` | Fiche Directeur / Admin |
| `src/docs/profiles/coordinator.md` | Fiche Chef de Secteur |
| `src/docs/profiles/agent.md` | Fiche Jardinier / Technicien |
| `src/docs/profiles/elu-partenaire.md` | Fiche Élu / Partenaire (virtuel) |
| `src/lib/auth-context.tsx` | Calcul `primaryRole` |
| `supabase/migrations/` | Enum `app_role`, RLS, triggers |

---

*Document produit pour l'équipe produit Verdura — base de conception de l'agent IA conversationnel.*
