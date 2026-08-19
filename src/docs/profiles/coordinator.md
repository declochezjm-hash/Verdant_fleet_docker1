# Fiche métier — Chef de Secteur / Coordinateur

> **Rôle Verdura :** `coordinator`  
> **Enum BDD :** `app_role = 'coordinator'` (`user_roles.role`)  
> **Dashboard par défaut :** `/` → `CoordinatorDashboard`  
> **Routes principales :** `/coordinator`, `/planning`, `/carte`, `/materiel`, `/anomalies`, `/stocks`, `/settings`

---

## Identité & mission

Le **Chef de Secteur** (Coordinateur Verdura) assure la **planification opérationnelle** des équipes terrain. Il traduit la stratégie du service en ordres de mission concrets : affectation des agents (`task_assignments`), mobilisation du matériel (`task_equipment`), suivi des chantiers par numéro (**C202X-XX**) et levée des anomalies remontées par le terrain.

---

## Périmètre opérationnel

| Domaine | Tables Verdura | Actions clés |
|---------|----------------|--------------|
| **Planification** | `tasks`, `task_assignments`, `teams` | CRUD chantiers, drag-and-drop planning, réaffectations |
| **Équipes terrain** | `profiles.team`, `teams` | Charge par équipe, disponibilité agents |
| **Flotte matériel** | `equipment`, `task_equipment`, `v_equipment_alerts` | Affectation engins, suivi `internal_id`, remplacement en panne |
| **Anomalies terrain** | `anomalies`, `equipment` | Triage, résolution (`resolved = true`), `repair_notes` |
| **Stocks & appro** | `products`, `purchase_orders`, `suppliers` | Réapprovisionnement, validation consommations |
| **Météo terrain** | `tasks.requires_dry_weather`, `weather_alert_status` | Report interventions sensibles |

---

## Points de suivi quotidiens

### Charge & planning

- [ ] Vue planning du jour : tous les `tasks` par `team` et `scheduled_at`
- [ ] Agents non affectés (`profiles` sans entrée `task_assignments` du jour)
- [ ] Chantiers **haute** / **urgente** sans assignation confirmée
- [ ] Conflits matériel : même `equipment_id` sur deux `tasks` simultanées

### Chantiers par numéro (`project_number`)

| Statut BDD | Action coordinateur |
|------------|---------------------|
| `planifie` | Valider fiche, confirmer agents + matériel |
| `en_cours` | Suivre avancement, lever blocages |
| `termine` | Contrôler clôture (photos, signature, `task_products`) |
| `annule` | Documenter motif dans `tasks.notes` |

### Matériel immobilisé

- [ ] Engins `status = 'En panne'` — identifier `equipment.internal_id` et délai réparation
- [ ] Alertes **`v_equipment_alerts`** — planifier maintenance préventive
- [ ] Réaffectation d'urgence : modifier `task_equipment` ou `equipment.assigned_to`

### Anomalies signalées par les agents

- [ ] File d'attente `anomalies` WHERE `resolved = false`, tri par `priority`
- [ ] Lier anomalie ↔ chantier (`task_id`) ↔ engin (`equipment_id`)
- [ ] Clôturer avec `repair_notes` après intervention atelier

---

## Check-list quotidienne

### Matin (avant 8 h)

- [ ] Consulter le planning `/planning` — valider les missions du jour par équipe
- [ ] Vérifier les alertes **`v_equipment_alerts`**
- [ ] Contrôler les chantiers en retard (`scheduled_at` < NOW(), `status = 'planifie'`)
- [ ] Valider les fiches chantiers créées la veille (`project_number`, `client`, `address`)

### Journée

- [ ] Traiter les anomalies `priority = 'urgente'` en priorité
- [ ] Réaffecter agents ou matériel en cas d'imprévu (absence, panne)
- [ ] Suivre les chantiers `en_cours` sur `/carte` (géolocalisation `lat`/`lng`)

### Soir

- [ ] Contrôler les clôtures (`status = 'termine'`) — photos, signature, lots phyto
- [ ] Reporter les retards au lendemain avec mise à jour `scheduled_at`
- [ ] Lever ou escalader les anomalies non résolues

---

## KPIs opérationnels

| KPI | Source BDD | Usage |
|-----|------------|-------|
| **Taux de couverture planning** | Chantiers avec `task_assignments` / total planifiés | Mesure charge équipes |
| **Délai moyen résolution anomalie** | `anomalies.created_at` → date résolution | Qualité flotte |
| **Engins immobilisés** | COUNT `equipment` WHERE `status = 'En panne'` | Capacité opérationnelle |
| **Respect météo** | `weather_alert_status != 'ok'` sur chantiers sensibles | Sécurité interventions |

---

## Accès données & RLS

| Ressource | Lecture | Écriture |
|-----------|:-------:|:--------:|
| Tous les `tasks` | ✅ | ✅ CRUD |
| `task_assignments`, `task_equipment`, `task_products` | ✅ | ✅ |
| `profiles` (collaborateurs) | ✅ | ✅ (équipe, invitation) |
| `teams`, `equipment`, `products` | ✅ | ✅ |
| `anomalies` | ✅ | ✅ (résolution) |
| `villes_fleuries_evaluations` | ✅ | ✅ |
| Analytics `/analytics` | ✅ | ❌ (consultation) |

> **Mise en garde :** la différence avec le rôle `admin` est surtout **UI** (dashboard analytique vs opérationnel). L'agent IA ne doit pas exposer les marges financières détaillées à un coordinateur sauf demande explicite du profil connecté.

---

## Vocabulaire agent IA

| Terme métier | Référence Verdura |
|--------------|-------------------|
| Ordre de mission | `tasks` + `task_assignments` |
| N° chantier | `tasks.project_number` (ex. **C2024-15**) |
| Équipe Nord / Sud | `teams.name` = `tasks.team` |
| Engin immobilisé | `equipment.internal_id` + `status = 'En panne'` |
| Agent terrain | `profiles.name` via `task_assignments.user_id` |

---

## Exemples d'interactions avec l'agent IA

1. **« Montre-moi tous les chantiers de l'équipe Nord prévus demain avec leur `project_number`, les agents assignés et le matériel mobilisé (`task_equipment`). »**

2. **« Quels engins sont en panne (`equipment.status = 'En panne'`) avec leur `internal_id`, et quels chantiers `C202X-XX` prévus cette semaine utilisent ces engins ? »**

3. **« Liste les anomalies non résolues signalées aujourd'hui par les agents, triées par priorité, avec le chantier et l'engin concernés. »**

---

## Réaffectations d'urgence — procédure type

```
1. Identifier le chantier impacté (project_number)
2. Vérifier v_equipment_alerts ou anomalies ouvertes
3. Proposer engin de remplacement (equipment.team compatible)
4. Mettre à jour task_equipment + notifier agent (task_assignments)
5. Reporter l'intervention initiale (tasks.scheduled_at, tasks.notes)
```

---

*Fiche alignée sur `docs/AUDIT_APPLICATION_VERDURA.md` — enum `app_role`, tables PostgreSQL Supabase.*
