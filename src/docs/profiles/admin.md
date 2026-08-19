# Fiche métier — Directeur Espaces Verts / Admin

> **Rôle Verdura :** `admin`  
> **Enum BDD :** `app_role = 'admin'` (`user_roles.role`)  
> **Dashboard par défaut :** `/` → `AdminAnalytics`  
> **Routes principales :** `/analytics`, `/settings`, `/coordinator`, `/stocks`, `/materiel`, `/anomalies`

---

## Identité & mission

Le **Directeur Espaces Verts** (Administrateur Verdura) pilote la performance globale du service : coûts d'exploitation, disponibilité du parc matériel, conformité réglementaire (AMM phyto, traçabilité lots) et qualité de service aux collectivités et clients (`tasks.client`).

Il dispose d'une **vision transversale** sur toutes les équipes (`teams.name`), tous les chantiers (`tasks.project_number`) et l'ensemble du parc (`equipment.internal_id`).

---

## Périmètre opérationnel

| Domaine | Tables Verdura | Actions clés |
|---------|----------------|--------------|
| **Supervision chantiers** | `tasks`, `task_assignments` | Suivi statuts (`planifie` → `en_cours` → `termine`), priorités (`normale` / `haute` / `urgente`) |
| **Coûts & marges** | `tasks.budget`, `tasks.labor_cost`, `teams.margin_pct`, `teams.overhead_*_pct` | Analyse CA, déboursé sec, marge par client |
| **Parc matériel** | `equipment`, `maintenance_logs`, `v_equipment_alerts` | Arbitrages investissement, suivi immobilisations |
| **Conformité phyto** | `products.amm_number`, `task_products.lot_number`, `task_products.dose_per_m2` | Contrôle registre, stocks sous seuil |
| **Anomalies critiques** | `anomalies` (`resolved`, `priority`) | Escalade pannes impactant la continuité de service |
| **Villes Fleuries** | `villes_fleuries_evaluations` | Pilotage audits, recommandations jury |
| **Gouvernance** | `profiles`, `user_roles`, `teams` | Paramétrage organisationnel, blocage comptes (`is_blocked`) |

---

## Points de suivi quotidiens

### Chantiers (`tasks`)

- [ ] Taux d'avancement : ratio `status = 'termine'` vs chantiers planifiés sur la période
- [ ] Chantiers en retard (`scheduled_at` dépassé, `status != 'termine'`)
- [ ] Chantiers **urgents** (`priority = 'urgente'`) non démarrés
- [ ] Écarts budget réalisé (`labor_cost`) vs `budget` par `project_number`

### Matériel (`equipment`, `v_equipment_alerts`)

- [ ] Consultation vue **`v_equipment_alerts`** (pannes + seuils maintenance)
- [ ] Engins `status = 'En panne'` ou `'Maintenance requise'`
- [ ] Coûts cumulés `maintenance_logs.cost` sur le trimestre

### Conformité & stocks (`products`, `task_products`)

- [ ] Produits Phyto sous `threshold` (catégorie `Phyto`)
- [ ] Traçabilité AMM : vérification présence `lot_number` sur clôtures récentes
- [ ] Commandes en attente (`purchase_orders.status`)

### Anomalies (`anomalies`)

- [ ] Anomalies non résolues (`resolved = false`) avec `priority = 'urgente'`
- [ ] Corrélation panne matériel ↔ retard chantier

---

## KPIs de référence

| KPI | Formule / source BDD | Cible indicative |
|-----|----------------------|------------------|
| **Chantiers livrés dans les temps** | `tasks` terminés avant `scheduled_at + duration` | ≥ 90 % |
| **Taux de disponibilité matériel** | 1 − (engins `En panne` / total actifs non archivés) | ≥ 85 % |
| **Consommation produits réglementés** | Σ `task_products.quantity` WHERE `products.category = 'Phyto'` | Suivi mensuel |
| **Marge nette globale** | Σ (`budget` − `labor_cost`) / Σ `budget` sur `status = 'termine'` | Selon `teams.margin_pct` |
| **Anomalies critiques ouvertes** | COUNT `anomalies` WHERE `resolved = false` AND `priority = 'urgente'` | → 0 en 48 h |

---

## Accès données & RLS

| Ressource | Lecture | Écriture |
|-----------|:-------:|:--------:|
| Tous les `tasks` | ✅ | ✅ |
| `profiles` / `user_roles` | ✅ | ✅ |
| `teams`, `equipment`, `products` | ✅ | ✅ |
| `villes_fleuries_evaluations` | ✅ | ✅ |
| `jarvis_messages` (historique IA) | ✅ (propre session) | ✅ |

> **Mise en garde :** en l'état du schéma cloud, le RLS est **désactivé** sur `tasks`, `equipment` et `products`. L'agent IA doit malgré tout filtrer les réponses au périmètre métier du directeur, sans exposer de données personnelles inutiles (`profiles.email`, `hourly_rate` des agents).

---

## Vocabulaire agent IA

| Terme métier | Référence Verdura |
|--------------|-------------------|
| N° chantier | `tasks.project_number` (ex. **C2024-01**) |
| Client / site | `tasks.client` + `tasks.address` |
| Équipe | `tasks.team` ↔ `teams.name` |
| N° interne engin | `equipment.internal_id` |
| N° AMM | `products.amm_number` |

---

## Exemples d'interactions avec l'agent IA

1. **« Quel est le taux de marge nette par client sur les chantiers terminés ce trimestre, et quels sont les trois `project_number` les plus déficitaires ? »**

2. **« Liste tous les engins présents dans `v_equipment_alerts` avec leur `internal_id`, et indique quels chantiers (`C202X-XX`) sont impactés par une panne matériel associée. »**

3. **« Quels produits Phyto sont sous le seuil d'alerte (`stock <= threshold`) et quelles consommations (`task_products.lot_number`) ont été enregistrées cette semaine ? »**

---

## Limites connues (audit Verdura)

> - Pas de module **patrimoine arboré** — les questions sur arbres individuels ne sont pas couvertes.
> - Pas d'entité **site/parc** structurée — le regroupement se fait par `tasks.client`.
> - Table **`clients`** utilisée en UI mais schéma non versionné — valider en prod avant requêtes automatisées.

---

*Fiche alignée sur `docs/AUDIT_APPLICATION_VERDURA.md` — enum `app_role`, tables PostgreSQL Supabase.*
