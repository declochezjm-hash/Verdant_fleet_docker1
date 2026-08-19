# Spécification technique — Outils IA (Function Calling) & couche BDD

> **Version :** 1.0 — 19 août 2026  
> **Rôle :** Tech Lead Backend & AI System Architect  
> **Références :** `docs/AUDIT_APPLICATION_VERDURA.md`, `docs/SPEC_FICHES_METIERS_VERDURA.md`  
> **Périmètre :** 5 outils read-only, client Supabase isolé, sécurisation RBAC/RLS.

---

## 0. Contexte & alignement schéma Verdura

### État actuel de la BDD (audit)

| Concept spec générique | Équivalent Verdura actuel | Note |
|------------------------|---------------------------|------|
| `organization_id` | ❌ **Absent** | Mono-organisation ; lien par `teams.name` (texte) |
| `team_id` (UUID) | `teams.id` + filtre `tasks.team` / `profiles.team` (texte) | Pas de FK — jointure par **nom** |
| `client_scope` | ❌ **Absent** (cible `partner`) | À porter en JWT claim ou colonne `profiles.allowed_clients` |
| `app_role = partner` | ❌ **Absent** | Enum actuel : `agent`, `coordinator`, `admin` |
| Statuts chantier API | `planifie`, `en_cours`, `termine`, `annule` | Mapper depuis `pending` / `in_progress` / `completed` |
| Sévérité anomalie | `normale`, `haute`, `urgente` | Mapper depuis `low` / `medium` / `critical` |
| Statut matériel API | `OK`, `Maintenance requise`, `En panne` | Mapper depuis `available` / `maintenance` / `broken` |

> **Règle d'implémentation :** les outils exposent des paramètres **API normalisés** (anglais) ; la couche BDD traduit vers les enums/colonnes PostgreSQL Verdura.

---

## A. Architecture de la couche BDD IA

### A.1 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent LLM (OpenAI / compatible Function Calling)                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │ tool calls
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  server/ai/toolRouter.ts                                          │
│  • Validation JSON Schema                                         │
│  • Matrice RBAC (app_role)                                        │
│  • Scope guard (team / client_scope)                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  server/db/readOnlyClient.ts                                      │
│  • Client Supabase JWT utilisateur (anon key + Authorization)     │
│  • AUCUNE clé service_role                                        │
│  • rpc/sql via .from().select() uniquement                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │ RLS PostgreSQL hérité
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Supabase PostgreSQL (public.*)                                   │
└──────────────────────────────────────────────────────────────────┘
```

### A.2 Mode Read-Only stricte — `server/db/readOnlyClient.ts`

**Objectif :** garantir qu'aucun outil IA ne peut muter la BDD (pas d'`INSERT`/`UPDATE`/`DELETE`/`rpc` d'écriture).

```typescript
// server/db/readOnlyClient.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const ALLOWED_METHODS = new Set(["select", "rpc"] as const);

/** Contexte session injecté par le middleware auth */
export interface AiSessionContext {
  userId: string;
  accessToken: string;
  primaryRole: "admin" | "coordinator" | "agent" | "partner";
  teamName: string | null;          // profiles.team
  clientScope: string[] | null;     // partner only — JWT claim ou metadata
  organizationId: string | null;    // réservé migration future
}

/**
 * Client Supabase read-only scoping JWT utilisateur.
 * NE JAMAIS utiliser SUPABASE_SERVICE_ROLE_KEY ici.
 */
export function createReadOnlyClient(ctx: AiSessionContext): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY!;

  const client = createClient<Database>(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${ctx.accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return wrapReadOnlyProxy(client);
}

/** Proxy bloquant toute mutation accidentelle */
function wrapReadOnlyProxy(client: SupabaseClient<Database>): SupabaseClient<Database> {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "from") {
        return (table: string) => {
          const builder = target.from(table);
          return blockMutations(builder, table);
        };
      }
      if (prop === "rpc") {
        return (fn: string, _args?: unknown) => {
          throw new AiToolError(
            "RPC_FORBIDDEN",
            `RPC '${fn}' interdit en mode read-only IA.`,
            403,
          );
        };
      }
      return Reflect.get(target, prop);
    },
  }) as SupabaseClient<Database>;
}

function blockMutations(builder: ReturnType<SupabaseClient["from"]>, table: string) {
  const forbidden = ["insert", "update", "upsert", "delete"];
  return new Proxy(builder, {
    get(t, method) {
      if (forbidden.includes(String(method))) {
        return () => {
          throw new AiToolError(
            "WRITE_FORBIDDEN",
            `Mutation '${String(method)}' interdite sur '${table}' (read-only IA).`,
            403,
          );
        };
      }
      return Reflect.get(t, method);
    },
  });
}
```

**Interdictions explicites :**

| Opération | Autorisée | Raison |
|-----------|:---------:|--------|
| `.from().select()` | ✅ | Lecture RLS |
| `.from().insert/update/delete/upsert` | ❌ | Proxy + spec read-only |
| `.rpc('finish_task')` | ❌ | Écriture métier |
| `service_role` key | ❌ | Contournement RLS |
| SQL brut côté agent | ❌ | Uniquement requêtes encapsulées dans les tools |

### A.3 Isolation multi-tenant & RLS

Verdura est **mono-organisation** aujourd'hui. La spec prévoit trois niveaux de filtrage **cumulatifs** :

```
┌─────────────────────────────────────────────────────────┐
│ Niveau 1 — RLS PostgreSQL (JWT auth.uid())              │
│   Hérité automatiquement par readOnlyClient              │
├─────────────────────────────────────────────────────────┤
│ Niveau 2 — Scope applicatif (toolRouter)                │
│   agent     → task_assignments.user_id = auth.uid()      │
│   coord/admin → profiles.team optionnel                │
│   partner   → tasks.client IN (client_scope)           │
├─────────────────────────────────────────────────────────┤
│ Niveau 3 — organization_id (migration future)           │
│   teams.organization_id = ctx.organizationId             │
│   (non actif — documenté pour extensibilité)           │
└─────────────────────────────────────────────────────────┘
```

#### Règles de filtrage par rôle

| Rôle | Filtre `organization_id` | Filtre `team` | Filtre `client_scope` |
|------|--------------------------|---------------|------------------------|
| `admin` | Futur : optional | Optional param `teamName` | — |
| `coordinator` | Futur : optional | Default : `profiles.team` | — |
| `agent` | Futur : optional | Default : `profiles.team` | — |
| `partner` | Futur : required | — | **Required** : `tasks.client IN (...)` |

#### Helper scope (à implémenter dans `server/ai/scopeGuard.ts`)

```typescript
export interface ScopeFilters {
  teamName?: string;
  assignedUserId?: string;
  clientNames?: string[];
}

export function buildScopeFilters(ctx: AiSessionContext): ScopeFilters {
  switch (ctx.primaryRole) {
    case "agent":
      return { assignedUserId: ctx.userId, teamName: ctx.teamName ?? undefined };
    case "coordinator":
      return { teamName: ctx.teamName ?? undefined };
    case "admin":
      return {};
    case "partner":
      if (!ctx.clientScope?.length) {
        throw new AiToolError("SCOPE_MISSING", "client_scope requis pour le rôle partner.", 403);
      }
      return { clientNames: ctx.clientScope };
    default:
      throw new AiToolError("ROLE_UNKNOWN", "Rôle non reconnu.", 403);
  }
}
```

> **Dette connue (audit) :** RLS **désactivé** sur `tasks`, `equipment`, `products` en cloud. Le `scopeGuard` applicatif est **obligatoire** en attendant la réactivation RLS prod.

### A.4 Sécurisation par rôle — matrice d'exécution des outils

| Outil | Badge UX | `admin` | `coordinator` | `agent` | `partner` |
|-------|----------|:-------:|:-------------:|:-------:|:---------:|
| `getChantiersSummary` | Analyse Chantiers | ✅ | ✅ | ✅ assignés | ✅ filtré client |
| `getEquipmentAlerts` | Flotte & Matériel | ✅ | ✅ | ✅ équipe | ❌ |
| `getAnomaliesReport` | Suivi Incidents | ✅ | ✅ | ✅ own/report | ❌ |
| `getProductsConformity` | Conformité Phyto | ✅ | ✅ | ✅ lecture | ❌ |
| `getProfileGuide` | Guide Métier | ✅ | ✅ | ✅ | ✅ |

**Colonnes masquées par rôle (post-traitement) :**

| Colonne | admin | coordinator | agent | partner |
|---------|:-----:|:-----------:|:-----:|:-------:|
| `tasks.budget` | ✅ | ⚠️ | ❌ | ❌ |
| `tasks.labor_cost` | ✅ | ⚠️ | ❌ | ❌ |
| `profiles.hourly_rate` | ✅ | ❌ | ❌ | ❌ |
| `profiles.name` (autres agents) | ✅ | ✅ | ❌ | ❌ |
| `maintenance_logs.cost` | ✅ | ✅ | ❌ | ❌ |

---

## B. Catalogue des outils IA (Function Calling)

### Conventions communes

#### Types partagés

```typescript
// server/ai/tools/types.ts

export type ApiTaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type ApiPriority = "normal" | "high" | "urgent";
export type ApiPeriod = "week" | "month" | "day";
export type ApiEquipmentStatus = "available" | "maintenance" | "broken";
export type ApiAnomalySeverity = "low" | "medium" | "critical";
export type ApiAnomalyStatus = "open" | "resolved";
export type ProfileRole = "admin" | "coordinator" | "agent" | "elu-partenaire";

export interface AiToolErrorPayload {
  code: string;
  message: string;
  httpStatus: number;
}

export class AiToolError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus: number = 500,
  ) {
    super(message);
    this.name = "AiToolError";
  }

  toJSON(): AiToolErrorPayload {
    return { code: this.code, message: this.message, httpStatus: this.httpStatus };
  }
}
```

#### Mappings enum Verdura

```typescript
// server/ai/tools/mappings.ts

export const TASK_STATUS_MAP: Record<ApiTaskStatus, string> = {
  pending: "planifie",
  in_progress: "en_cours",
  completed: "termine",
  cancelled: "annule",
};

export const PRIORITY_MAP: Record<ApiPriority, string> = {
  normal: "normale",
  high: "haute",
  urgent: "urgente",
};

export const EQUIPMENT_STATUS_MAP: Record<ApiEquipmentStatus, string> = {
  available: "OK",
  maintenance: "Maintenance requise",
  broken: "En panne",
};

export const SEVERITY_MAP: Record<ApiAnomalySeverity, string> = {
  low: "normale",
  medium: "haute",
  critical: "urgente",
};
```

#### Enregistrement OpenAI (extrait)

```typescript
// server/ai/tools/registry.ts

export const VERDURA_AI_TOOLS = [
  { type: "function", function: { name: "getChantiersSummary", ... } },
  { type: "function", function: { name: "getEquipmentAlerts", ... } },
  { type: "function", function: { name: "getAnomaliesReport", ... } },
  { type: "function", function: { name: "getProductsConformity", ... } },
  { type: "function", function: { name: "getProfileGuide", ... } },
] as const;
```

---

### 1. `getChantiersSummary`

**Badge UX :** *Analyse Chantiers*

#### Description

Synthèse des chantiers (`tasks`) par statut, urgence, période ou équipe. Calcule le taux de réalisation et liste les chantiers en retard.

#### Signature TypeScript

```typescript
export interface GetChantiersSummaryInput {
  status?: ApiTaskStatus;
  priority?: ApiPriority;
  teamName?: string;   // Verdura: tasks.team (texte) — pas teamId UUID
  period?: ApiPeriod;
}

export interface ChantierListItem {
  projectNumber: string | null;
  title: string;
  client: string;
  address: string;
  status: ApiTaskStatus;
  priority: ApiPriority;
  scheduledAt: string;
  delayDays: number | null;
}

export interface GetChantiersSummaryOutput {
  badge: "Analyse Chantiers";
  total: number;
  completedCount: number;
  completionRatePct: number;
  overdueCount: number;
  filters: GetChantiersSummaryInput;
  items: ChantierListItem[];
}
```

#### JSON Schema OpenAI (parameters)

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["pending", "in_progress", "completed", "cancelled"],
      "description": "Statut du chantier. pending=planifie, in_progress=en_cours, completed=termine, cancelled=annule."
    },
    "priority": {
      "type": "string",
      "enum": ["normal", "high", "urgent"],
      "description": "Priorité métier (normale, haute, urgente)."
    },
    "teamName": {
      "type": "string",
      "description": "Nom de l'équipe Verdura (ex. 'Équipe Nord'). Correspond à tasks.team et teams.name."
    },
    "period": {
      "type": "string",
      "enum": ["day", "week", "month"],
      "description": "Fenêtre temporelle basée sur tasks.scheduled_at."
    }
  },
  "additionalProperties": false
}
```

#### JSON Schema OpenAI (response — documentation)

```json
{
  "type": "object",
  "required": ["badge", "total", "completedCount", "completionRatePct", "overdueCount", "items"],
  "properties": {
    "badge": { "const": "Analyse Chantiers" },
    "total": { "type": "integer" },
    "completedCount": { "type": "integer" },
    "completionRatePct": { "type": "number" },
    "overdueCount": { "type": "integer" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["projectNumber", "title", "client", "status", "scheduledAt"],
        "properties": {
          "projectNumber": { "type": ["string", "null"] },
          "title": { "type": "string" },
          "client": { "type": "string" },
          "address": { "type": "string" },
          "status": { "type": "string" },
          "priority": { "type": "string" },
          "scheduledAt": { "type": "string", "format": "date-time" },
          "delayDays": { "type": ["integer", "null"] }
        }
      }
    }
  }
}
```

#### Requête Supabase / SQL sous-jacente

**Scope agent :** jointure obligatoire `task_assignments`.

```sql
-- Équivalent SQL (exécuté via PostgREST / supabase-js)

-- 1) Agrégats
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE t.status = 'termine') AS completed_count,
  COUNT(*) FILTER (
    WHERE t.status IN ('planifie', 'en_cours')
      AND t.scheduled_at < NOW()
  ) AS overdue_count
FROM tasks t
LEFT JOIN task_assignments ta ON ta.task_id = t.id
WHERE
  ($team_name IS NULL OR t.team = $team_name)
  AND ($status_db IS NULL OR t.status = $status_db::task_status)
  AND ($priority_db IS NULL OR t.priority = $priority_db)
  AND ($period_start IS NULL OR t.scheduled_at >= $period_start)
  AND ($period_end IS NULL OR t.scheduled_at < $period_end)
  AND ($assigned_user_id IS NULL OR ta.user_id = $assigned_user_id)
  AND ($client_names IS NULL OR t.client = ANY($client_names));

-- 2) Liste (LIMIT 50)
SELECT
  t.project_number,
  t.title,
  t.client,
  t.address,
  t.status,
  t.priority,
  t.scheduled_at,
  CASE
    WHEN t.status IN ('planifie', 'en_cours') AND t.scheduled_at < NOW()
    THEN EXTRACT(DAY FROM NOW() - t.scheduled_at)::int
    ELSE NULL
  END AS delay_days
FROM tasks t
LEFT JOIN task_assignments ta ON ta.task_id = t.id
WHERE /* mêmes filtres */
ORDER BY t.scheduled_at ASC
LIMIT 50;
```

**Implémentation Supabase-js :**

```typescript
let query = client
  .from("tasks")
  .select(
    "project_number, title, client, address, status, priority, scheduled_at, task_assignments!inner(user_id)",
    { count: "exact" },
  );

if (scope.assignedUserId) {
  query = query.eq("task_assignments.user_id", scope.assignedUserId);
}
if (input.teamName ?? scope.teamName) {
  query = query.eq("team", input.teamName ?? scope.teamName!);
}
if (input.status) query = query.eq("status", TASK_STATUS_MAP[input.status]);
if (input.priority) query = query.eq("priority", PRIORITY_MAP[input.priority]);
if (periodStart) query = query.gte("scheduled_at", periodStart.toISOString());
if (periodEnd) query = query.lt("scheduled_at", periodEnd.toISOString());
if (scope.clientNames) query = query.in("client", scope.clientNames);

const { data, error, count } = await query
  .order("scheduled_at", { ascending: true })
  .limit(50);
```

---

### 2. `getEquipmentAlerts`

**Badge UX :** *Flotte & Matériel*

#### Description

Consultation de l'état du parc (`equipment`) et de la vue d'alerte (`v_equipment_alerts`). Inclut coûts de maintenance récents (`maintenance_logs`).

#### Signature TypeScript

```typescript
export interface GetEquipmentAlertsInput {
  status?: ApiEquipmentStatus;
  type?: string;
  onlyAlerts?: boolean;
  teamName?: string;
}

export interface EquipmentAlertItem {
  internalId: string | null;
  name: string;
  type: string;
  status: ApiEquipmentStatus;
  hoursUsed: number;
  hoursForMaintenance: number;
  team: string | null;
  isAlert: boolean;
  recentMaintenanceCost: number | null;
}

export interface GetEquipmentAlertsOutput {
  badge: "Flotte & Matériel";
  total: number;
  immobilizedCount: number;
  alertCount: number;
  items: EquipmentAlertItem[];
}
```

#### JSON Schema OpenAI (parameters)

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["available", "maintenance", "broken"],
      "description": "available=OK, maintenance=Maintenance requise, broken=En panne."
    },
    "type": {
      "type": "string",
      "description": "Type d'engin (equipment.type), ex. tondeuse, taille-haie."
    },
    "onlyAlerts": {
      "type": "boolean",
      "description": "Si true, restreint à v_equipment_alerts (pannes + seuil maintenance)."
    },
    "teamName": {
      "type": "string",
      "description": "Filtre equipment.team (texte)."
    }
  },
  "additionalProperties": false
}
```

#### Requête SQL sous-jacente

```sql
-- Mode onlyAlerts = true
SELECT
  e.id,
  e.internal_id,
  e.name,
  e.type,
  e.status,
  e.hours_used,
  e.hours_for_maintenance,
  e.team,
  TRUE AS is_alert,
  (
    SELECT COALESCE(SUM(ml.cost), 0)
    FROM maintenance_logs ml
    WHERE ml.equipment_id = e.id
      AND ml.date >= CURRENT_DATE - INTERVAL '90 days'
  ) AS recent_maintenance_cost
FROM v_equipment_alerts va
JOIN equipment e ON e.id = va.id
WHERE e.is_archived = false
  AND ($team_name IS NULL OR e.team = $team_name)
  AND ($type IS NULL OR e.type ILIKE '%' || $type || '%')
  AND ($status_db IS NULL OR e.status = $status_db::equipment_status);

-- Mode onlyAlerts = false
SELECT /* mêmes colonnes */, (va.id IS NOT NULL) AS is_alert
FROM equipment e
LEFT JOIN v_equipment_alerts va ON va.id = e.id
WHERE e.is_archived = false
  /* filtres identiques */;
```

**Règle agent :** si `primaryRole === 'agent'`, forcer `teamName = ctx.teamName`.

**Calcul `immobilizedCount` :** `COUNT(*) WHERE status = 'En panne'`.

---

### 3. `getAnomaliesReport`

**Badge UX :** *Suivi Incidents*

#### Description

Extraction des anomalies terrain (`anomalies`) avec chantiers impactés (`tasks.project_number`) et médias liés via le chantier (`photo_before_url`, `photo_after_url` — **pas de colonne photo sur `anomalies`**).

#### Signature TypeScript

```typescript
export interface GetAnomaliesReportInput {
  severity?: ApiAnomalySeverity;
  status?: ApiAnomalyStatus;
  period?: ApiPeriod;
  teamName?: string;
}

export interface AnomalyReportItem {
  id: string;
  description: string | null;
  severity: ApiAnomalySeverity;
  status: ApiAnomalyStatus;
  createdAt: string;
  projectNumber: string | null;
  taskTitle: string | null;
  equipmentInternalId: string | null;
  equipmentName: string | null;
  attachedMediaUrls: string[];
}

export interface GetAnomaliesReportOutput {
  badge: "Suivi Incidents";
  totalOpen: number;
  total: number;
  items: AnomalyReportItem[];
}
```

#### JSON Schema OpenAI (parameters)

```json
{
  "type": "object",
  "properties": {
    "severity": {
      "type": "string",
      "enum": ["low", "medium", "critical"],
      "description": "low=normale, medium=haute, critical=urgente. Colonne anomalies.priority (si absente, défaut normale)."
    },
    "status": {
      "type": "string",
      "enum": ["open", "resolved"],
      "description": "open=resolved false, resolved=resolved true."
    },
    "period": {
      "type": "string",
      "enum": ["day", "week", "month"],
      "description": "Filtre sur anomalies.created_at."
    },
    "teamName": {
      "type": "string",
      "description": "Filtre via tasks.team joint."
    }
  },
  "additionalProperties": false
}
```

#### Requête SQL sous-jacente

```sql
SELECT
  a.id,
  a.description,
  COALESCE(a.priority, 'normale') AS priority,
  a.resolved,
  a.created_at,
  a.reported_by,
  t.project_number,
  t.title AS task_title,
  t.photo_before_url,
  t.photo_after_url,
  e.internal_id AS equipment_internal_id,
  e.name AS equipment_name
FROM anomalies a
LEFT JOIN tasks t ON t.id = a.task_id
LEFT JOIN equipment e ON e.id = a.equipment_id
WHERE
  ($status_resolved IS NULL OR a.resolved = $status_resolved)
  AND ($priority_db IS NULL OR COALESCE(a.priority, 'normale') = $priority_db)
  AND ($period_start IS NULL OR a.created_at >= $period_start)
  AND ($period_end IS NULL OR a.created_at < $period_end)
  AND ($team_name IS NULL OR t.team = $team_name)
  AND ($assigned_user_id IS NULL OR a.reported_by = $assigned_user_id
       OR EXISTS (
         SELECT 1 FROM task_assignments ta
         WHERE ta.task_id = a.task_id AND ta.user_id = $assigned_user_id
       ))
ORDER BY a.created_at DESC
LIMIT 100;
```

**Post-traitement `attachedMediaUrls` :**

```typescript
attachedMediaUrls: [task.photo_before_url, task.photo_after_url].filter(Boolean)
```

> **Note schéma cloud :** la colonne `anomalies.priority` peut être absente — utiliser `COALESCE(..., 'normale')`.

---

### 4. `getProductsConformity`

**Badge UX :** *Conformité Phyto*

#### Description

Vérification des produits (`products`) : validité AMM, stock, seuils d'alerte. Les **EPI requis** sont dérivés par règle métier (catégorie `Phyto`) — **non stockés en BDD**.

#### Signature TypeScript

```typescript
export interface GetProductsConformityInput {
  ammNumber?: string;
  searchQuery?: string;
  onlyControlled?: boolean;
}

export interface ProductConformityItem {
  id: string;
  name: string;
  ammNumber: string | null;
  category: "Engrais" | "Phyto" | "Semences";
  stock: number;
  threshold: number;
  isBelowThreshold: boolean;
  unit: string;
  epiRequired: string[] | null;
  usageConditions: string | null;
}

export interface GetProductsConformityOutput {
  badge: "Conformité Phyto";
  total: number;
  controlledCount: number;
  belowThresholdCount: number;
  items: ProductConformityItem[];
}
```

#### JSON Schema OpenAI (parameters)

```json
{
  "type": "object",
  "properties": {
    "ammNumber": {
      "type": "string",
      "description": "Numéro AMM exact (products.amm_number)."
    },
    "searchQuery": {
      "type": "string",
      "description": "Recherche partielle sur products.name ou amm_number."
    },
    "onlyControlled": {
      "type": "boolean",
      "description": "Si true, filtre category = 'Phyto' (produits réglementés)."
    }
  },
  "additionalProperties": false
}
```

#### Requête SQL sous-jacente

```sql
SELECT
  p.id,
  p.name,
  p.amm_number,
  p.category,
  p.stock,
  p.threshold,
  p.unit,
  (p.stock <= p.threshold) AS is_below_threshold
FROM products p
WHERE
  ($only_controlled = false OR p.category = 'Phyto')
  AND ($amm_number IS NULL OR p.amm_number = $amm_number)
  AND (
    $search_query IS NULL
    OR p.name ILIKE '%' || $search_query || '%'
    OR p.amm_number ILIKE '%' || $search_query || '%'
  )
ORDER BY p.category, p.name
LIMIT 100;
```

#### Règles métier EPI (post-traitement — non BDD)

```typescript
const EPI_PHYTO_DEFAULT = [
  "Gants chimiques certifiés",
  "Lunettes étanches",
  "Masque anti-poussière / vapeurs (selon produit)",
  "Blouse ou combinaison jetable",
  "Bottes imperméables",
];

function enrichProductConformity(row: ProductRow): ProductConformityItem {
  return {
    ...row,
    epiRequired: row.category === "Phyto" ? EPI_PHYTO_DEFAULT : null,
    usageConditions:
      row.category === "Phyto"
        ? "Respecter la dose homologuée (task_products.dose_per_m2) et le registre phytosanitaire (lot_number obligatoire à la clôture)."
        : null,
  };
}
```

**Traçabilité consommations (enrichissement optionnel Tier 2) :**

```sql
SELECT tp.lot_number, tp.dose_per_m2, tp.quantity, t.project_number
FROM task_products tp
JOIN tasks t ON t.id = tp.task_id
JOIN products p ON p.id = tp.product_id
WHERE p.amm_number = $amm_number
ORDER BY tp.created_at DESC
LIMIT 20;
```

---

### 5. `getProfileGuide`

**Badge UX :** *Guide Métier*

#### Description

Lecture du fichier Markdown de fiche métier (`src/docs/profiles/*.md`) correspondant au rôle. **Ne touche pas à Supabase** — filesystem / bundle statique.

#### Signature TypeScript

```typescript
export interface GetProfileGuideInput {
  role: ProfileRole;
}

export interface GetProfileGuideOutput {
  badge: "Guide Métier";
  role: ProfileRole;
  appRole: "admin" | "coordinator" | "agent" | "partner" | null;
  filePath: string;
  contentMarkdown: string;
  loadedAt: string;
}
```

#### JSON Schema OpenAI (parameters)

```json
{
  "type": "object",
  "required": ["role"],
  "properties": {
    "role": {
      "type": "string",
      "enum": ["admin", "coordinator", "agent", "elu-partenaire"],
      "description": "Profil métier Verdura. elu-partenaire = rôle partner virtuel."
    }
  },
  "additionalProperties": false
}
```

#### Mapping fichiers

| `role` param | Fichier | `app_role` BDD |
|--------------|---------|----------------|
| `admin` | `src/docs/profiles/admin.md` | `admin` |
| `coordinator` | `src/docs/profiles/coordinator.md` | `coordinator` |
| `agent` | `src/docs/profiles/agent.md` | `agent` |
| `elu-partenaire` | `src/docs/profiles/elu-partenaire.md` | `partner` (virtuel) |

#### Implémentation

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";

const PROFILE_FILES: Record<ProfileRole, string> = {
  admin: "src/docs/profiles/admin.md",
  coordinator: "src/docs/profiles/coordinator.md",
  agent: "src/docs/profiles/agent.md",
  "elu-partenaire": "src/docs/profiles/elu-partenaire.md",
};

export async function getProfileGuide(input: GetProfileGuideInput): Promise<GetProfileGuideOutput> {
  const rel = PROFILE_FILES[input.role];
  if (!rel) throw new AiToolError("PROFILE_NOT_FOUND", `Profil '${input.role}' inconnu.`, 404);

  const filePath = path.join(process.cwd(), rel);
  const contentMarkdown = await readFile(filePath, "utf-8");

  return {
    badge: "Guide Métier",
    role: input.role,
    appRole: input.role === "elu-partenaire" ? "partner" : input.role,
    filePath: rel,
    contentMarkdown,
    loadedAt: new Date().toISOString(),
  };
}
```

**Règle sécurité :** un utilisateur authentifié ne peut charger que la fiche de **son** `primaryRole`, sauf `admin` (accès toutes fiches). Refuser avec `403 INSUFFICIENT_ROLE` sinon.

---

## C. Gestion des erreurs

### C.1 Catalogue des codes erreur

| Code | HTTP | Cause | Message utilisateur IA |
|------|:----:|-------|------------------------|
| `DB_UNAVAILABLE` | 503 | Supabase timeout / réseau | « La base de données est temporairement indisponible. Réessayez dans quelques instants. » |
| `DB_QUERY_ERROR` | 500 | Erreur PostgREST (`error.message`) | « Impossible de récupérer les données demandées. » |
| `WRITE_FORBIDDEN` | 403 | Tentative mutation | « Cette action de modification n'est pas autorisée via l'assistant. » |
| `RPC_FORBIDDEN` | 403 | Appel RPC | Idem |
| `TOOL_NOT_ALLOWED` | 403 | Matrice RBAC §A.4 | « Votre profil ne permet pas d'accéder à cette fonctionnalité. » |
| `SCOPE_MISSING` | 403 | Partner sans `client_scope` | « Votre accès partenaire n'est pas configuré. » |
| `INSUFFICIENT_ROLE` | 403 | `getProfileGuide` rôle incorrect | « Cette fiche métier ne correspond pas à votre profil. » |
| `VALIDATION_ERROR` | 400 | JSON Schema invalide | « Paramètres de recherche invalides : … » |
| `PROFILE_NOT_FOUND` | 404 | Fichier MD absent | « Fiche métier introuvable. » |

### C.2 Enveloppe de réponse standard

```typescript
export type AiToolResult<T> =
  | { ok: true; data: T; meta: { tool: string; durationMs: number } }
  | { ok: false; error: AiToolErrorPayload; meta: { tool: string; durationMs: number } };
```

```typescript
export async function executeTool<TInput, TOutput>(
  toolName: string,
  ctx: AiSessionContext,
  input: TInput,
  handler: (client: SupabaseClient, ctx: AiSessionContext, input: TInput) => Promise<TOutput>,
): Promise<AiToolResult<TOutput>> {
  const start = Date.now();
  try {
    assertToolAllowed(toolName, ctx.primaryRole);
    const client = createReadOnlyClient(ctx);
    const data = await handler(client, ctx, input);
    return { ok: true, data, meta: { tool: toolName, durationMs: Date.now() - start } };
  } catch (err) {
    if (err instanceof AiToolError) {
      return { ok: false, error: err.toJSON(), meta: { tool: toolName, durationMs: Date.now() - start } };
    }
    if (isSupabaseNetworkError(err)) {
      return {
        ok: false,
        error: new AiToolError("DB_UNAVAILABLE", "Supabase inaccessible.", 503).toJSON(),
        meta: { tool: toolName, durationMs: Date.now() - start },
      };
    }
    return {
      ok: false,
      error: new AiToolError("DB_QUERY_ERROR", "Erreur interne de lecture.", 500).toJSON(),
      meta: { tool: toolName, durationMs: Date.now() - start },
    };
  }
}
```

### C.3 Journalisation & audit

Chaque appel outil doit persister une entrée dans `jarvis_messages` :

```typescript
await client.from("jarvis_messages").insert({
  user_id: ctx.userId,
  role: "system",
  content: `[tool:${toolName}]`,
  metadata: {
    tool: toolName,
    input,
    ok: result.ok,
    errorCode: result.ok ? null : result.error.code,
    durationMs: result.meta.durationMs,
  },
});
```

> **Note :** l'insertion `jarvis_messages` est une **exception** à read-only — exécutée via un client audit dédié **uniquement** sur cette table, ou via Edge Function séparée.

---

## D. Roadmap technique

| Priorité | Action | Impact |
|:--------:|--------|--------|
| P0 | Réactiver RLS sur `tasks`, `equipment`, `products` | Sécurité prod |
| P0 | Implémenter `scopeGuard` applicatif (RLS cloud incomplet) | Isolation agent/partner |
| P1 | Ajouter `app_role = 'partner'` + claim `client_scope` | Profil Élu natif |
| P1 | Migration `organization_id` sur `teams` + FK futures | Multi-tenant |
| P2 | Colonnes `products.epi_required[]`, `anomalies.priority` | Conformité phyto native |
| P2 | Régénérer `types.ts` Supabase | Typage tools |
| P3 | Vue `v_client_dashboard` pour partner | Perf requêtes |

---

## E. Références

| Document | Contenu |
|----------|---------|
| `docs/AUDIT_APPLICATION_VERDURA.md` | Schéma BDD, RLS, entités |
| `docs/SPEC_FICHES_METIERS_VERDURA.md` | Profils, matrice accès, injection prompt |
| `src/docs/profiles/*.md` | Fiches métier sources `getProfileGuide` |
| `supabase/.temp/cloud-schema.sql` | Schéma cloud de référence |
| `src/lib/auth-context.tsx` | Calcul `primaryRole` |

---

*Spécification prête pour implémentation — Phase 1 : `readOnlyClient.ts` + 5 handlers + `toolRouter.ts` + tests RBAC par rôle.*
