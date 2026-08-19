# Fiche métier — Jardinier / Technicien Terrain

> **Rôle Verdura :** `agent`  
> **Enum BDD :** `app_role = 'agent'` (`user_roles.role`)  
> **Dashboard par défaut :** `/` → `AgentSupabaseView`  
> **Routes accessibles (sidebar) :** `/planning`, `/carte` uniquement

---

## Identité & mission

Le **Jardinier / Technicien terrain** (Agent Verdura) exécute les **chantiers qui lui sont assignés** (`task_assignments`). Il consulte ses ordres de mission, utilise le matériel affecté, respecte les consignes de sécurité et EPI, consomme les produits autorisés (`task_products`) et **remonte immédiatement** toute anomalie ou incident (`anomalies`).

---

## Périmètre opérationnel

| Domaine | Tables Verdura | Actions clés |
|---------|----------------|--------------|
| **Missions du jour** | `tasks`, `task_assignments` | Consultation, démarrage (`status → en_cours`), clôture (`finish_task`) |
| **Matériel assigné** | `equipment`, `task_equipment` | Contrôle état, signalement panne (`status → En panne`) |
| **Produits & phyto** | `products`, `task_products` | Consultation fiches, saisie `lot_number`, `dose_per_m2` à la clôture |
| **Anomalies terrain** | `anomalies` | INSERT avec `reported_by = auth.uid()` |
| **Preuves d'exécution** | `tasks.photo_before_url`, `photo_after_url`, `signature_url` | Upload bucket `task-media` |
| **Météo** | `requires_dry_weather`, `actual_weather` | Respect contraintes avant démarrage |

---

## Points de suivi quotidiens

### Ordres de mission (`tasks` + `task_assignments`)

- [ ] Consulter les chantiers assignés du jour (`scheduled_at`, `project_number`)
- [ ] Vérifier adresse (`address`) et client (`client`) avant départ
- [ ] Contrôler priorité (`normale` / `haute` / `urgente`) et contrainte météo
- [ ] Lire les notes coordinateur (`tasks.notes`)

### Matériel utilisé (`equipment`, `task_equipment`)

- [ ] Identifier l'engin par **`internal_id`** (ex. **001**, **TON-042**)
- [ ] Contrôler `status` avant prise en main : doit être `OK`
- [ ] Vérifier compteur `hours_used` si pertinent
- [ ] Signaler toute anomalie **avant** utilisation si doute

### Produits & sécurité (`products`)

- [ ] Consulter la fiche produit : `name`, `amm_number` (Phyto), `category`
- [ ] Porter EPI adaptés à la catégorie (Phyto = EPI renforcés)
- [ ] Ne consommer que les produits prévus sur le chantier

---

## Check-list terrain

### Avant prise en main du matériel

- [ ] Engin conforme (`equipment.status = 'OK'`)
- [ ] `internal_id` correspond à la fiche `task_equipment`
- [ ] Niveaux / sécurité vérifiés (check visuel)
- [ ] EPI portés (casque, gants, lunettes selon opération)

### Pendant le chantier (`status = en_cours`)

- [ ] Photo **avant** intervention (`photo_before_url`)
- [ ] Respect du périmètre (`address`, `lat`/`lng` sur `/carte`)
- [ ] En cas d'incident : **signaler anomalie immédiatement** (ne pas attendre la fin)
- [ ] Respecter `requires_dry_weather` si activé

### Clôture chantier (`finish_task`)

- [ ] Photo **après** intervention (`photo_after_url`)
- [ ] Signature client (`signature_url`)
- [ ] Saisie consommations : `task_products.quantity`, `lot_number`, `dose_per_m2`
- [ ] Mise à jour compteur matériel si applicable
- [ ] Passage `status → termine`

---

## Statuts chantier — cycle agent

| Statut | Signification | Action agent |
|--------|---------------|--------------|
| `planifie` | Mission confirmée, non démarrée | Se rendre sur site, démarrer |
| `en_cours` | Intervention en cours | Exécuter, documenter |
| `termine` | Clôturé | — |
| `annule` | Mission annulée | Ne pas intervenir |

---

## Accès données & RLS

| Ressource | Lecture | Écriture |
|-----------|:-------:|:--------:|
| Chantiers **assignés** (`is_assigned()`) | ✅ | ✅ UPDATE (démarrer, clôturer) |
| Planning global autres équipes | ❌ | ❌ |
| `products` (inventaire) | ✅ | ✅ sur ses `task_products` |
| `equipment` | ✅ | ✅ signalement panne (statut limité) |
| `anomalies` | ✅ | ✅ INSERT (`reported_by` = self) |
| Analytics, settings, stocks admin | ❌ (UI) | ❌ |
| `villes_fleuries_evaluations` | ❌ | ❌ |

> **Mise en garde sécurité :** l'agent ne doit **jamais** recevoir via l'IA les coordonnées ou marges financières des autres agents. Filtrer sur `task_assignments.user_id = auth.uid()`.

---

## Vocabulaire agent IA

| Terme métier | Référence Verdura |
|--------------|-------------------|
| Ma mission | `tasks` WHERE `task_assignments.user_id` = moi |
| N° chantier | `tasks.project_number` |
| Mon engin | `equipment` via `task_equipment` |
| Signaler un problème | INSERT `anomalies` |
| Clôturer | RPC **`finish_task`** |

---

## Exemples d'interactions avec l'agent IA

1. **« Quelles sont mes missions aujourd'hui avec le `project_number`, l'adresse, la priorité et le matériel assigné (`equipment.internal_id`) ? »**

2. **« L'engin `internal_id` TON-042 est en panne sur le chantier C2024-08 — enregistre une anomalie urgente et indique-moi si j'ai une mission de remplacement demain. »**

3. **« Quels produits Phyto avec numéro AMM sont prévus sur mon chantier C2024-12, et quelle dose par m² (`dose_per_m2`) dois-je enregistrer à la clôture ? »**

---

## Consignes EPI & sécurité (rappel agent IA)

> - **Phyto** (`products.category = 'Phyto'`) : EPI complets, respect des doses, traçabilité `lot_number` obligatoire.
> - **Météo sèche requise** (`requires_dry_weather = true`) : ne pas démarrer si `weather_alert_status != 'ok'`.
> - **Anomalie matériel** : stopper l'utilisation, créer `anomalies` avec description précise, alerter le coordinateur.

---

*Fiche alignée sur `docs/AUDIT_APPLICATION_VERDURA.md` — enum `app_role`, tables PostgreSQL Supabase.*
