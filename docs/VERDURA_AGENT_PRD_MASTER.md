# Verdura Agent — Product Requirements Document (Master)

> **Document maître** — Agent IA conversationnel Verdura  
> **Version :** 1.0 · 19 août 2026  
> **Auteur :** CPO & Lead Architect AI  
> **Statut :** Spécifications consolidées — prêt pour implémentation

---

## Documents sources

| Document | Rôle | Chemin |
|----------|------|--------|
| Audit applicatif | Schéma BDD, routes, RLS, entités | `docs/AUDIT_APPLICATION_VERDURA.md` |
| Fiches métiers | Profils, RBAC, injection prompt | `docs/SPEC_FICHES_METIERS_VERDURA.md` |
| Outils IA | Function Calling, readOnlyClient, SQL | `docs/SPEC_OUTILS_IA_VERDURA.md` |
| UX/UI | Drawer, hook, Markdown, contexte | `docs/SPEC_UX_UI_VERDURA.md` |

---

## 1. Vision produit & périmètre

### 1.1 Mission de l'agent Verdura

**Verdura Agent** est le copilote IA conversationnel intégré à l'application Verdura. Il assiste les équipes d'espaces verts dans leur **gestion opérationnelle quotidienne** : suivi des chantiers, état de la flotte matériel, conformité phytosanitaire et remontée d'incidents terrain.

L'agent ne remplace pas l'application métier — il **accélère l'accès à l'information** et **formalise les bonnes pratiques** par rôle, en s'appuyant sur les données réelles Supabase et un historique conversationnel persistant.

### 1.2 Proposition de valeur

| Bénéficiaire | Problème adressé | Valeur apportée |
|--------------|------------------|-----------------|
| **Jardinier / Technicien** | Consultation fragmentée des missions | « Mes chantiers du jour » en langage naturel |
| **Chef de secteur** | Vision planning + anomalies dispersée | Synthèse retards, pannes, réaffectations |
| **Directeur espaces verts** | KPIs noyés dans l'analytique | Marge, conformité phyto, disponibilité flotte |
| **Élu / Partenaire** | Manque de transparence collectivité | Avancement travaux & label Villes Fleuries (virtuel) |

### 1.3 Périmètre fonctionnel (v1)

| Inclus v1 | Exclu v1 |
|-----------|----------|
| Chat drawer global, persistance `jarvis_messages` | Écriture BDD via l'agent (CRUD chantiers) |
| 5 outils read-only (Function Calling) | Patrimoine arboré (non modélisé) |
| 4 fiches métiers Markdown injectables | Routes dynamiques `/task/:id` (phase 2) |
| Capture contexte URL + React | Multi-tenant `organization_id` (roadmap) |
| Rendu Markdown sobriété végétale | Voix / multimodal |

### 1.4 Rôles supportés

Verdura expose **3 rôles authentifiés** PostgreSQL et **1 profil virtuel** :

| Profil métier | Enum `app_role` | Fiche Markdown | Dashboard Verdura |
|---------------|:---------------:|----------------|-------------------|
| Directeur Espaces Verts | `admin` | `src/docs/profiles/admin.md` | `AdminAnalytics` |
| Chef de Secteur | `coordinator` | `src/docs/profiles/coordinator.md` | `CoordinatorDashboard` |
| Jardinier / Technicien | `agent` | `src/docs/profiles/agent.md` | `AgentSupabaseView` |
| Élu / Partenaire | *virtuel* `partner` | `src/docs/profiles/elu-partenaire.md` | — (à implémenter) |

**Hiérarchie session :** `admin` > `coordinator` > `agent` (`primaryRole` dans `auth-context.tsx`).

### 1.5 Valeur métier par entité BDD

| Entité | Table Verdura | Identifiant clé | Usage agent |
|--------|---------------|-----------------|-------------|
| Chantier | `tasks` | `project_number` (C202X-XX) | Planning, retards, clôtures |
| Équipe | `teams` | `name` (texte) | Filtrage opérationnel |
| Matériel | `equipment` | `internal_id` | Pannes, maintenance |
| Alerte flotte | `v_equipment_alerts` | vue | Immobilisations |
| Produit phyto | `products` | `amm_number` | Conformité, stocks |
| Anomalie | `anomalies` | `id` | Incidents terrain |
| Historique IA | `jarvis_messages` | `user_id` | Mémoire conversationnelle |

---

## 2. Architecture système global & flux de données

### 2.1 Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UTILISATEUR AUTHENTIFIÉ                          │
│                    (JWT Supabase — PKCE, user_roles)                     │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  COUCHE UI                                                               │
│  VerduraChatFab ──► VerduraChatDrawer.tsx                               │
│       │                  ├── VerduraChatHeader (contexte, guides, export)│
│       │                  ├── VerduraChatMessageList                      │
│       │                  │        └── VerduraMarkdown.tsx (remark-gfm)   │
│       │                  └── VerduraChatInput                            │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  COUCHE CLIENT                                                           │
│  useVerduraChat.ts                                                       │
│    • resolvePageContext() ← useLocation + searchParams + PageContext     │
│    • sendMessage() / sendProfileGuide()                                  │
│    • load/save jarvis_messages                                           │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ POST /api/ai/chat (SSE stream)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  COUCHE SERVEUR                                                          │
│  server/ai/chatHandler.ts                                                │
│    • Prompt système = fiche métier (src/docs/profiles/*.md)              │
│    • Contexte page + rôle session                                        │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LLM ENGINE (OpenAI — Function Calling)                                  │
│    • 5 tools enregistrés (JSON Schema)                                   │
│    • Réponses courtes (≤ 5 lignes) ou guides intégraux                   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ tool calls
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server/ai/toolRouter.ts                                                 │
│    • Validation Zod / JSON Schema                                        │
│    • Matrice RBAC (admin | coordinator | agent | partner)                │
│    • scopeGuard (team, assignedUserId, clientScope)                      │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  server/db/readOnlyClient.ts                                             │
│    • Supabase anon + JWT utilisateur                                     │
│    • Proxy anti-mutation (SELECT only)                                     │
│    • Hérite RLS PostgreSQL                                               │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SUPABASE POSTGRESQL                                                     │
│  tasks · equipment · products · anomalies · jarvis_messages · …        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Flux conversationnel (séquence)

```
1. Utilisateur ouvre VerduraChatDrawer (FAB ou Ctrl+Shift+V)
2. useVerduraChat charge les 50 derniers jarvis_messages (RLS user_id)
3. resolvePageContext() calcule contextLabel (ex. « Chantier C2024-01 »)
4. Utilisateur envoie un message (ou clique « Guides & Fiches Métier »)
5. INSERT jarvis_messages (role=user, metadata.context)
6. API chat → LLM avec tools + fiche métier en system prompt
7. LLM invoque 0–N tools → toolRouter → readOnlyClient → PostgreSQL
8. LLM formate réponse Markdown → stream SSE → UI
9. INSERT jarvis_messages (role=assistant, metadata.tool/toolBadge)
10. VerduraMarkdown rend la réponse (compact ou guide)
```

### 2.3 Garanties de sécurité

| Garantie | Mécanisme | Référence |
|----------|-----------|-----------|
| **Read-Only strict** | Proxy `readOnlyClient` — pas d'INSERT/UPDATE/DELETE sur données métier | `SPEC_OUTILS_IA` §A.2 |
| **Pas de service_role** | JWT utilisateur uniquement | Audit §5.3 |
| **Isolation RBAC** | Matrice outils × rôle + masquage colonnes sensibles | `SPEC_FICHES` §3 |
| **Scope applicatif** | agent → `task_assignments` ; partner → `client_scope` | `SPEC_OUTILS` §A.3 |
| **RLS PostgreSQL** | Hérité session ; P0 réactivation sur `tasks`/`equipment`/`products` | Audit §5.3 |
| **Traçabilité** | Chaque échange dans `jarvis_messages` + metadata tool/context | Audit §3.1 |
| **Fiches métier** | `getProfileGuide` limité au rôle session (admin = toutes) | `SPEC_OUTILS` §B.5 |

> **Dette connue :** RLS cloud partiellement désactivé sur tables cœur — le `scopeGuard` applicatif est **obligatoire** en attendant correction prod.

---

## 3. Synthèse des spécifications techniques

### 3.1 Catalogue des 5 outils IA (Function Calling)

| # | Outil | Badge UX | Tables BDD | Rôles |
|---|-------|----------|------------|:-----:|
| 1 | `getChantiersSummary` | Analyse Chantiers | `tasks`, `task_assignments`, `teams` | admin, coord, agent†, partner‡ |
| 2 | `getEquipmentAlerts` | Flotte & Matériel | `equipment`, `v_equipment_alerts`, `maintenance_logs` | admin, coord, agent† |
| 3 | `getAnomaliesReport` | Suivi Incidents | `anomalies`, `tasks`, `equipment` | admin, coord, agent† |
| 4 | `getProductsConformity` | Conformité Phyto | `products`, `task_products` | admin, coord, agent |
| 5 | `getProfileGuide` | Guide Métier | filesystem `src/docs/profiles/*.md` | tous |

† agent = données filtrées assignation / équipe  
‡ partner = filtré `client_scope`

#### Paramètres API normalisés → enums Verdura

| Paramètre API | Valeurs | Colonne / enum BDD |
|---------------|---------|-------------------|
| `status` (chantier) | pending, in_progress, completed, cancelled | `planifie`, `en_cours`, `termine`, `annule` |
| `priority` | normal, high, urgent | `normale`, `haute`, `urgente` |
| `status` (matériel) | available, maintenance, broken | `OK`, `Maintenance requise`, `En panne` |
| `severity` (anomalie) | low, medium, critical | `normale`, `haute`, `urgente` |

**Détail complet :** signatures TypeScript, JSON Schema OpenAI et requêtes SQL → `docs/SPEC_OUTILS_IA_VERDURA.md`.

---

### 3.2 Système de capture de contexte

Trois sources combinées alimentent le payload API :

| Source | Mécanisme | Exemple |
|--------|-----------|---------|
| **Route active** | `useLocation().pathname` | `/planning` → hint `getChantiersSummary` |
| **Search params** | `?taskId=`, `?equipmentId=`, `?productId=` | UUID → lookup `project_number` |
| **Context React** | `VerduraPageContext` (Sheets existantes) | `TaskDetailsSheet` → `openTaskId` |

#### Mapping pages Verdura → contexte

| Route | `pageKind` | Entité injectée |
|-------|------------|-----------------|
| `/planning`, `/coordinator`, `/carte` | planning / coordinator / carte | `taskId`, `projectNumber` |
| `/materiel` | materiel | `equipmentId`, `internalId` |
| `/stocks` | stocks | `productId`, `ammNumber` |
| `/anomalies` | anomalies | filtre incidents ouverts |
| `/analytics`, `/settings` | analytics / settings | vue générale |

**Contrat hook :** `UseVerduraChatReturn` → `docs/SPEC_UX_UI_VERDURA.md` §B.2.

---

### 3.3 Dossier documentation — fiches métiers

| Fichier | Rôle | Contenu clé |
|---------|------|-------------|
| `src/docs/profiles/admin.md` | `admin` | KPIs marge, conformité AMM, alertes flotte |
| `src/docs/profiles/coordinator.md` | `coordinator` | Planning, affectations, check-list quotidienne |
| `src/docs/profiles/agent.md` | `agent` | Missions, EPI, signalement anomalies |
| `src/docs/profiles/elu-partenaire.md` | `partner` (virtuel) | Transparence commune, Villes Fleuries |

**Injection :** system prompt LLM + outil `getProfileGuide` + bouton UI « Guides & Fiches Métier ».

---

### 3.4 Couche UX — composants clés

| Composant | Responsabilité |
|-----------|----------------|
| `VerduraChatDrawer.tsx` | Drawer global, charte sobriété végétale |
| `useVerduraChat.ts` | État, contexte, API, persistance |
| `VerduraMarkdown.tsx` | Rendu GFM — tableaux, checklists, blockquotes |
| `VerduraPageContext` | Pont Sheets → contexte agent |

#### Charte visuelle (extrait)

| Élément | Classes Tailwind |
|---------|------------------|
| Message utilisateur | `bg-slate-900 text-white` |
| Message Verdura | `bg-emerald-50/40 text-slate-800 border-emerald-100/60` |
| Badge outil | `bg-emerald-100 text-emerald-800` |

**Détail complet :** `docs/SPEC_UX_UI_VERDURA.md`.

---

### 3.5 Entités BDD — vue consolidée (audit)

| Tier | Tables | Usage agent |
|:----:|--------|-------------|
| **1** | `tasks`, `task_assignments`, `profiles`, `teams`, `equipment`, `v_equipment_alerts`, `products`, `anomalies` | Outils core |
| **2** | `task_products`, `task_equipment`, `maintenance_logs`, `clients`, `purchase_orders` | Enrichissement |
| **3** | `jarvis_messages`, `villes_fleuries_evaluations`, `eco_wallets` | Mémoire / partner |

**18 tables + 1 vue** documentées dans `docs/AUDIT_APPLICATION_VERDURA.md` §8.

---

## 4. Roadmap d'implémentation — 4 sprints

### Sprint 1 — Fondations & documentation (Semaine 1–2)

**Objectif :** Préparer l'infrastructure, les deps et la couche données read-only.

| # | Livrable | Critère done |
|---|----------|--------------|
| 1.1 | Valider fiches métiers `src/docs/profiles/*.md` (4 fichiers) | Revue CPO OK |
| 1.2 | Régénérer `src/integrations/supabase/types.ts` | Types alignés cloud |
| 1.3 | Créer `server/db/readOnlyClient.ts` + tests proxy anti-mutation | Aucun write possible |
| 1.4 | Créer `server/ai/scopeGuard.ts` + mappings enums | Tests unitaires mappings |
| 1.5 | Installer deps : `react-markdown`, `remark-gfm`, `zod` | `package.json` à jour |
| 1.6 | Créer `src/lib/verdura-page-context.tsx` (squelette) | Provider montable |

**Risques :** RLS cloud incomplet → scopeGuard obligatoire dès S1.

---

### Sprint 2 — Backend & outils IA (Semaine 3–4)

**Objectif :** API chat + 5 tools Function Calling opérationnels.

| # | Livrable | Critère done |
|---|----------|--------------|
| 2.1 | `server/ai/tools/*.ts` — 5 handlers + JSON Schema | Chaque tool retourne payload typé |
| 2.2 | `server/ai/toolRouter.ts` — RBAC + validation Zod | 403 si rôle non autorisé |
| 2.3 | `server/ai/chatHandler.ts` — route POST SSE | Stream OpenAI fonctionnel |
| 2.4 | System prompt dynamique (fiche métier + vocabulaire BDD) | 3 rôles testés |
| 2.5 | Audit trail `jarvis_messages` (insert user/assistant) | Metadata tool/context |
| 2.6 | Tests intégration : 1 requête par tool × 3 rôles | Matrice RBAC validée |

**Référence implémentation :** `docs/SPEC_OUTILS_IA_VERDURA.md`.

---

### Sprint 3 — Frontend & UX (Semaine 5–6)

**Objectif :** Interface chat complète intégrée à Verdura.

| # | Livrable | Critère done |
|---|----------|--------------|
| 3.1 | `useVerduraChat.ts` — contrat complet | Load/send/export/clear |
| 3.2 | `VerduraChatDrawer.tsx` + FAB dans `__root.tsx` | Accessible toutes pages auth |
| 3.3 | `VerduraMarkdown.tsx` — GFM + charte Tailwind | 4 exemples visuels §C.4 validés |
| 3.4 | Indicateur contexte + bouton « Guides & Fiches Métier » | Appel `getProfileGuide` direct |
| 3.5 | Copier au survol + Export `.md` daté | Fichier téléchargeable |
| 3.6 | Connecter `VerduraPageContext` à `TaskDetailsSheet`, matériel, stocks | ContextLabel correct |
| 3.7 | Chips suggestions par rôle | agent / coord / admin |

**Référence implémentation :** `docs/SPEC_UX_UI_VERDURA.md`.

---

### Sprint 4 — Recette & hardening (Semaine 7–8)

**Objectif :** Qualité, sécurité, déploiement production.

| # | Livrable | Critère done |
|---|----------|--------------|
| 4.1 | Réactiver RLS prod sur `tasks`, `equipment`, `products` | Audit sécurité OK |
| 4.2 | Tests RBAC exhaustifs (matrice §5 ci-dessous) | 0 fuite inter-équipes |
| 4.3 | Tests charge : 50 messages concurrents | p95 < 3 s réponse |
| 4.4 | `npm run typecheck` + lint sans erreur | CI verte |
| 4.5 | Tests E2E : parcours agent + coordinator + admin | Playwright / manuel signé |
| 4.6 | Documentation runbook ops (env vars, monitoring) | README agent |
| 4.7 | Déploiement staging → prod | Smoke test post-deploy |

**Roadmap post-v1 (P1) :** enum `partner`, claim `client_scope`, routes `/task/:id`, `organization_id`.

---

## 5. Matrice de contrôle — recette fonctionnelle

### 5.1 Tests par rôle

| # | Scénario | Agent | Coord | Admin | Partner |
|---|----------|:-----:|:-----:|:-----:|:-------:|
| R1 | « Mes missions aujourd'hui » — uniquement chantiers assignés | ✅ | ✅ | ✅ | ❌ |
| R2 | « Planning équipe Nord demain » | ❌ | ✅ | ✅ | ❌ |
| R3 | « Marge par client ce trimestre » | ❌ | ⚠️ | ✅ | ❌ |
| R4 | « Engins en panne » + `internal_id` | ⚠️ équipe | ✅ | ✅ | ❌ |
| R5 | « Stocks phyto sous seuil » | ✅ lecture | ✅ | ✅ | ❌ |
| R6 | « Anomalies ouvertes urgentes » | ✅ own | ✅ | ✅ | ❌ |
| R7 | Bouton « Guides & Fiches Métier » | ✅ agent.md | ✅ coord.md | ✅ admin.md | ✅ elu.md |
| R8 | Avancement travaux commune (sans coûts) | ❌ | ❌ | ❌ | ✅ |
| R9 | Tentative accès `budget`/`labor_cost` | ❌ masqué | ⚠️ | ✅ | ❌ |
| R10 | Export conversation `.md` | ✅ | ✅ | ✅ | ✅ |

### 5.2 Tests techniques

| # | Critère | Validation | Statut |
|---|---------|------------|:------:|
| T1 | `readOnlyClient` bloque INSERT/UPDATE/DELETE | Test unitaire | ☐ |
| T2 | Aucune clé `service_role` côté agent | Revue code | ☐ |
| T3 | `jarvis_messages` RLS — user A ≠ user B | Test intégration | ☐ |
| T4 | 5 tools — JSON Schema valide OpenAI | Lint schema | ☐ |
| T5 | Contexte `project_number` depuis Sheet ouvert | Test manuel planning | ☐ |
| T6 | Réponse courte ≤ 5 lignes (hors guide) | Revue prompt | ☐ |
| T7 | Guide métier restitué intégralement | Pas de troncature UI | ☐ |
| T8 | Stream SSE — reconnexion gracieuse | Test réseau | ☐ |
| T9 | `npm run typecheck` exit 0 | CI | ☐ |
| T10 | Drawer accessible `Ctrl+Shift+V` | Test a11y | ☐ |

### 5.3 Tests sécurité

| # | Critère | Statut |
|---|---------|:------:|
| S1 | Agent ne voit pas chantiers non assignés (scopeGuard + RLS) | ☐ |
| S2 | Partner sans `client_scope` → erreur `SCOPE_MISSING` | ☐ |
| S3 | Injection prompt — requêtes SQL non exécutables par LLM | ☐ |
| S4 | Colonnes sensibles masquées post-traitement (`hourly_rate`) | ☐ |
| S5 | `getProfileGuide` — rôle différent → 403 | ☐ |

### 5.4 Tests UX

| # | Critère | Statut |
|---|---------|:------:|
| U1 | Charte couleurs conforme (slate-900 / emerald-50) | ☐ |
| U2 | Badges outils visibles sur réponses tool | ☐ |
| U3 | Tableaux Markdown — en-tête slate-800 | ☐ |
| U4 | Blockquotes mise en garde — bordure emerald | ☐ |
| U5 | Copier au survol fonctionnel | ☐ |
| U6 | Mobile : drawer plein écran | ☐ |
| U7 | ContextLabel mis à jour au changement de page | ☐ |

---

## 6. Stack technique consolidée

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TanStack Router, Tailwind, shadcn Sheet |
| Markdown | `react-markdown`, `remark-gfm` |
| Backend agent | Node / TanStack Start server route |
| LLM | OpenAI API (Function Calling) |
| Validation | Zod + JSON Schema |
| BDD | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth JWT PKCE |
| Persistance chat | `jarvis_messages` |

---

## 7. Variables d'environnement requises

| Variable | Usage |
|----------|-------|
| `SUPABASE_URL` | Client read-only |
| `SUPABASE_ANON_KEY` | Client read-only (JWT user) |
| `OPENAI_API_KEY` | LLM engine |
| `OPENAI_MODEL` | ex. `gpt-4o` |

> **Interdit :** exposer `SUPABASE_SERVICE_ROLE_KEY` au runtime agent.

---

## 8. Arborescence cible

```
docs/
├── AUDIT_APPLICATION_VERDURA.md
├── SPEC_FICHES_METIERS_VERDURA.md
├── SPEC_OUTILS_IA_VERDURA.md
├── SPEC_UX_UI_VERDURA.md
└── VERDURA_AGENT_PRD_MASTER.md          ← ce document

src/
├── components/ai/
│   ├── VerduraChatDrawer.tsx
│   ├── VerduraMarkdown.tsx
│   └── …
├── hooks/useVerduraChat.ts
├── lib/verdura-page-context.tsx
└── docs/profiles/
    ├── admin.md
    ├── coordinator.md
    ├── agent.md
    └── elu-partenaire.md

server/
├── ai/
│   ├── chatHandler.ts
│   ├── toolRouter.ts
│   └── tools/
│       ├── getChantiersSummary.ts
│       ├── getEquipmentAlerts.ts
│       ├── getAnomaliesReport.ts
│       ├── getProductsConformity.ts
│       └── getProfileGuide.ts
└── db/readOnlyClient.ts
```

---

## 9. Indicateurs de succès (KPI produit)

| KPI | Baseline | Cible v1 (3 mois post-launch) |
|-----|----------|-------------------------------|
| Adoption hebdo (% utilisateurs actifs utilisant le chat) | 0 % | ≥ 40 % |
| Messages / utilisateur / semaine | — | ≥ 5 |
| Taux réponse satisfaisante (thumb up) | — | ≥ 75 % |
| Temps moyen accès info chantier | ~2 min (navigation UI) | < 30 s (chat) |
| Incidents sécurité RBAC | — | 0 |

---

## 10. Décisions produit archivées

| # | Décision | Alternatives écartées | Date |
|---|----------|----------------------|------|
| D1 | Mode **read-only** strict pour v1 | Tools d'écriture (CRUD chantiers) | 2026-08-19 |
| D2 | JWT user (pas service_role) | Backend service_role + filtre manuel | 2026-08-19 |
| D3 | Fiches métier en **Markdown filesystem** | CMS externe | 2026-08-19 |
| D4 | Partner = profil **virtuel** v1 | Enum BDD immédiat | 2026-08-19 |
| D5 | Contexte via PageContext + search params | Refonte routing `/task/:id` immédiate | 2026-08-19 |

---

## 11. Glossaire Verdura Agent

| Terme | Définition |
|-------|------------|
| **Chantier** | Entité `tasks` — unité métier centrale |
| **N° chantier** | `tasks.project_number` (ex. C2024-01) |
| **N° interne** | `equipment.internal_id` |
| **AMM** | `products.amm_number` — autorisation phytosanitaire |
| **Tool** | Fonction appelable par le LLM (Function Calling) |
| **Scope guard** | Filtre applicatif complémentaire au RLS |
| **Guide** | Fiche métier Markdown restituée sans troncature |

---

*Document maître Verdura Agent v1.0 — synthèse des spécifications produit, technique et UX. Toute évolution majeure doit mettre à jour ce PRD et les documents sources référencés.*
