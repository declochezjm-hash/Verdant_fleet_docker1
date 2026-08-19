# Fiche métier — Élu / Client / Partenaire Externe

> **Rôle Verdura :** *Mapping virtuel* — **aucun enum `app_role` en BDD**  
> **Statut technique :** profil **non authentifié** ou accès **lecture seule filtrée** (à implémenter)  
> **Tables principales :** `tasks`, `villes_fleuries_evaluations`, `clients`

---

## Identité & mission

L'**Élu**, le **client collectivité** ou le **partenaire externe** (ex. jury *Villes Fleuries*) dispose d'une **vision synthétique et non opérationnelle** de l'avancement des travaux sur sa commune ou son secteur. Il ne gère ni planning, ni matériel, ni stocks — il consulte des **indicateurs de transparence** et des **bilans qualitatifs** du cadre de vie.

> **Mise en garde architecture :** ce profil **n'existe pas** dans l'enum PostgreSQL `app_role` (`agent` | `coordinator` | `admin`). L'agent IA Verdura doit simuler ce comportement via un **prompt système dédié** et un **filtre de données** (ex. `tasks.client = 'Mairie de X'`), sans accès aux données internes (marges, `hourly_rate`, anomalies détaillées).

---

## Correspondance technique (mapping virtuel)

| Attribut fiche | Implémentation Verdura actuelle | Cible recommandée |
|----------------|--------------------------------|-------------------|
| Rôle BDD | ❌ Absent | Créer `app_role = 'partner'` ou JWT claim `client_scope` |
| Authentification | ❌ Pas de compte dédié | Compte invité read-only ou portail public |
| Périmètre données | Filtrage manuel par `tasks.client` | RLS `tasks.client IN (user.allowed_clients)` |
| Villes Fleuries | `villes_fleuries_evaluations` (coord/admin only) | Vue agrégée sans détail opérationnel |

---

## Périmètre de consultation

| Domaine | Tables Verdura | Niveau d'information |
|---------|----------------|----------------------|
| **Avancement travaux** | `tasks` (filtré par `client`) | Statut, dates, adresse — **sans** coûts internes |
| **Transparence chantiers** | `tasks.project_number`, `tasks.status`, `tasks.scheduled_at` | Vue calendrier simplifiée |
| **Qualité cadre de vie** | Agrégats par `tasks.client` | Nb interventions terminées, secteurs couverts |
| **Label Villes Fleuries** | `villes_fleuries_evaluations` | `commune_name`, `evaluated_level`, `jury_decision`, `recommendations` |
| **Réclamations** | Non modélisé | À créer (`complaints` ou champ `tasks.notes` filtré) |

### Données **exclues** du périmètre élu

| Donnée | Raison |
|--------|--------|
| `tasks.budget`, `tasks.labor_cost` | Confidentialité financière |
| `profiles.hourly_rate` | Donnée RH |
| `products.stock`, `amm_number` détaillé | Sécurité & approvisionnement |
| `anomalies` détaillées | Exploitation interne |
| `equipment.internal_id`, maintenance | Flotte interne |

---

## Points de suivi (vision partenaire)

### Transparence chantiers en cours

- [ ] Nombre de chantiers `en_cours` sur la commune (`tasks.client`)
- [ ] Prochaines interventions planifiées (`status = 'planifie'`, `scheduled_at`)
- [ ] Chantiers terminés ce mois (`status = 'termine'`) — preuve d'activité
- [ ] Secteurs couverts (agrégation par `address` / quartier)

### Label *Villes Fleuries*

- [ ] Dernière évaluation : `villes_fleuries_evaluations.visit_date`
- [ ] Niveau évalué : `evaluated_level`
- [ ] Décision jury : `jury_decision`
- [ ] Recommandations : `recommendations` (synthèse vulgarisée)
- [ ] Critères détaillés : `evaluation_criteria` (JSONB — restitution graphique)

### Indicateurs qualité cadre de vie

| Indicateur | Source | Restitution élu |
|------------|--------|-----------------|
| Interventions réalisées / mois | COUNT `tasks` terminés | Courbe simple |
| Délais moyens | `finished_at` − `scheduled_at` | Jours (sans détail chantier) |
| Couverture géographique | DISTINCT `address` | Carte simplifiée (sans agents) |

---

## Comparatif accès — Élu vs rôles internes

| Donnée | Élu / Partenaire | Agent | Coordinator | Admin |
|--------|:----------------:|:-----:|:-----------:|:-----:|
| Statut chantiers (filtré client) | ✅ synthèse | ✅ assignés | ✅ tous | ✅ tous |
| Coûts & marges | ❌ | ❌ | ⚠️ | ✅ |
| Matériel / anomalies | ❌ | ✅ | ✅ | ✅ |
| Évaluations VF | ✅ lecture | ❌ | ✅ | ✅ |
| Planning détaillé agents | ❌ | ✅ own | ✅ | ✅ |

---

## Restitution IA — ton & format

L'agent IA doit adapter ses réponses pour ce profil :

- **Langage vulgarisé** — pas de jargon (`task_assignments`, RLS, etc.)
- **Agrégats avant détails** — « 12 interventions terminées en mars » avant de lister les adresses
- **Pas de noms d'agents** — anonymiser `profiles.name`
- **Focus qualité de vie** — verdissement, entretien, label VF

> **Exemple de reformulation :**  
> ❌ « Le chantier C2024-08 assigné à Jean Dupont a un `labor_cost` de 320 €. »  
> ✅ « L'entretien du parc municipal de votre commune prévu cette semaine est en cours ; la prochaine intervention de tonte est planifiée jeudi. »

---

## Exemples d'interactions avec l'agent IA

1. **« Où en sont les travaux d'entretien des espaces verts sur la commune de [X] ce mois-ci ? Combien d'interventions sont terminées et lesquelles sont encore en cours ? »**
   *(Filtre : `tasks.client` = commune, masquer budget et agents)*

2. **« Quel est le dernier résultat de notre évaluation *Villes Fleuries* (`villes_fleuries_evaluations`) et quelles sont les principales recommandations du jury ? »**
   *(Restitution de `evaluated_level`, `jury_decision`, `recommendations`)*

3. **« Quelles interventions sont prévues dans les deux prochaines semaines sur les secteurs [quartier A] et [quartier B] ? »**
   *(Filtre : `tasks.address` LIKE, statuts `planifie` / `en_cours` uniquement)*

---

## Feuille de route technique (hors périmètre actuel)

| Action | Priorité | Impact |
|--------|:--------:|--------|
| Ajouter `app_role = 'partner'` ou claim JWT `client_scope` | Haute | Authentification propre |
| RLS lecture filtrée sur `tasks.client` | Haute | Sécurité |
| Vue publique `v_client_dashboard` | Moyenne | Performance requêtes IA |
| Module réclamations | Moyenne | Suivi demandes élus |
| Route UI `/portail-commune` | Basse | Alternative à l'agent seul |

---

*Fiche alignée sur `docs/AUDIT_APPLICATION_VERDURA.md` — profil virtuel, enum `app_role` non couvert natif.*
