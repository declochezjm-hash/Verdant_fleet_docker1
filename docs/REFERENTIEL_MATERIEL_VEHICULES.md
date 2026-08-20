# Référentiel Matériel & Véhicules — Bible Verdura

> **Version :** 1.0 — 20 août 2026  
> **Public :** agents terrain, chefs de secteur, coordinateurs, responsables parc, agent IA Verdura  
> **Complément végétal :** `docs/REFERENTIEL_ESPACES_VERTS.md`  
> **Complément technique :** `docs/AUDIT_APPLICATION_VERDURA.md`

---

## 1. Objet et périmètre

Ce document constitue la **bible flotte et matériel** du projet Verdura. Il couvre :

- la **typologie** du parc (véhicules, engins, outillage thermique et électrique) ;
- les **protocoles d'entretien** préventif et curatif ;
- les **consignes de sécurité** et **EPI** obligatoires ;
- l'articulation avec les entités Supabase (`equipment`, `anomalies`, `maintenance_logs`, `task_equipment`).

> **Standard flotte Verdura :** chaque machine possède un identifiant métier **`internal_id`** (ex. `001`, `TND-04`). Les alertes maintenance sont calculées via `hours_used` / `hours_for_maintenance` et exposées dans la vue **`v_equipment_alerts`**.

---

## 2. Lien avec la base de données Verdura

### 2.1 Entités matériel

| Entité | Table / vue | Rôle |
|--------|-------------|------|
| **Matériel / engin** | `equipment` | Fiche machine (nom, type, statut, heures) |
| **Identifiant métier** | `equipment.internal_id` | Référence unique terrain (autocollant, QR) |
| **Statut opérationnel** | `equipment.status` | `OK` · `Maintenance requise` · `En panne` |
| **Heures d'utilisation** | `equipment.hours_used` | Compteur cumulé (RPC `finish_task`) |
| **Seuil révision** | `equipment.hours_for_maintenance` | Déclenche alerte préventive |
| **Alertes actives** | `v_equipment_alerts` | Machines en panne OU heures ≥ seuil |
| **Affectation agent** | `equipment.assigned_to` | Profil responsable (`profiles.id`) |
| **Équipe** | `equipment.team` | Aligné sur `teams.name` |
| **Coût horaire** | `equipment.hourly_cost` | Analytique chantier |
| **Historique entretien** | `maintenance_logs` | Type, coût, date |
| **Mobilisation chantier** | `task_equipment` | Lien `task_id` ↔ `equipment_id` |
| **Anomalie / panne** | `anomalies` | Signalement terrain, priorité, résolution |
| **Archivage** | `equipment.is_archived` | Exclu des alertes actives |

### 2.2 Enum `equipment_status` — Signification opérationnelle

| Statut BDD | Signification | Action attendue |
|-------------|---------------|-----------------|
| **`OK`** | Opérationnel, révisions à jour | Mobilisable sur chantier |
| **`Maintenance requise`** | Seuil heures atteint ou entretien planifié | Planifier révision avant usage intensif |
| **`En panne`** | Immobilisation, danger ou panne avérée | **Interdiction d'utilisation** — créer `anomalies` |

### 2.3 Workflow Verdura — Du terrain à la maintenance

```
Agent signale problème
        │
        ▼
  anomalies (INSERT) ──► equipment.status = 'En panne' (si critique)
        │
        ▼
  Coordinateur planifie maintenance_logs
        │
        ▼
  Réparation / révision ──► status = 'OK', reset compteur si applicable
        │
        ▼
  Réaffectation task_equipment sur nouveau chantier
```

---

## 3. Typologie de la flotte Verdura

### 3.1 Classification par `equipment.type`

| Type Verdura | Catégorie | Exemples | Motorisation |
|--------------|-----------|----------|--------------|
| **Engin** | Autoporté lourd | Tracteur, autoportée, mini-chargeur | Thermique |
| **Tondeuse** | Tonte pelouse | Tondeuse push, autoportée légère | Thermique / électrique |
| **Débroussailleuse** | Fauchage, bordures | Portée, dorsale, fléau | Thermique / batterie |
| **Taille-haie** | Taille haies | Taille-haie sur perche, compact | Thermique / batterie |
| **Tronçonneuse** | Abattage, ébranchage | Tronçonneuse, élagueuse | Thermique / batterie |
| **Souffleur** | Nettoyage, feuilles | Souffleur portatif | Thermique / batterie |
| **Pulvérisateur** | Traitement phyto | Pulvé à dos, sur béton | Manuel / thermique |
| **Remorque / porte-outils** | Transport | Remorque bancale, porte-outils | Attelage |
| **Véhicule utilitaire** | Logistique | Fourgon, pick-up, utilitaire benne | Thermique / électrique |
| **Outillage manuel** | Complément | Binette, sécateur, râteau | Manuel |

> **Convention `internal_id` :** format recommandé `[TYPE]-[NUM]` — ex. `TND-01` (tondeuse), `DBR-03` (débroussailleuse), `UTL-02` (utilitaire). Facilite les requêtes agent IA : « Quel est le statut de TND-01 ? »

### 3.2 Matrice synthétique — Parc type collectivité (27–28 machines)

| Catégorie | Quantité indicative | `hours_for_maintenance` type | Risque principal |
|-----------|--------------------|------------------------------|------------------|
| Tondeuses autoportées | 4–6 | 100–150 h | Lames, courroies, sécurité OP |
| Tondeuses push | 3–5 | 80–100 h | Lames, carter |
| Débroussailleuses | 6–8 | 60–80 h | Fil, embrayage, vibrations |
| Taille-haies | 3–4 | 80–100 h | Lames, perche |
| Tronçonneuses | 4–6 | 50–70 h | **Coupe / projection** |
| Souffleurs | 2–3 | 50 h | Projection, bruit |
| Tracteurs / engins | 2–3 | 150–250 h | ROPS, attelage, hydraulique |
| Véhicules utilitaires | 3–5 | Entretien km + h | Circulation, chargement |
| Pulvérisateurs | 2–3 | 40–60 h | Contamination phyto |

---

## 4. Véhicules utilitaires

### 4.1 Typologie

| Type | Usage espaces verts | Capacité | Points de contrôle |
|------|---------------------|----------|-------------------|
| **Fourgon** | Transport équipe + outils | 3–5 pers. | Arrimage, charge, permis B |
| **Pick-up benne** | Déchets verts, sable, plants | 800–1200 kg | Benne, bâche, surcharge |
| **Utilitaire compact** | Patrouille, petits chantiers | 2 pers. | Manœuvrabilité urbaine |
| **Remorque porte-engins** | Transport tondeuse autoportée | Selon PTAC | Freinage, sangles, rampes |

### 4.2 Check-list véhicule — Départ de parc

- [ ] Permis et assurance valides (conducteur identifié)
- [ ] Contrôle visuel : pneus, feux, rétroviseurs, pare-brise
- [ ] Niveaux : huile, liquide refroidissement, lave-glace
- [ ] Carburant / charge suffisants pour la tournée
- [ ] Arrimage outils et produits phyto (bac étanche si Phyto)
- [ ] Équipements obligatoires : triangle, gilet, trousse secours
- [ ] Noter kilométrage / anomalies dans Verdura si problème (`anomalies`)

### 4.3 Règles de chargement

> **Interdit :**
> - Transporter produits phyto non fermés ou non étiquetés
> - Surcharger benne au-delà du PTAC
> - Transporter passagers sans siège homologué
> - Laisser outils coupants non protégés en benne

| Charge | Fixation | Séparation |
|--------|----------|------------|
| Déchets verts | Bâche + sangles | Séparé des EPI propres |
| Produits Phyto | Bac confinement | Jamais avec denrées ou EPI |
| Outillage | Caisses, arrimage | Tronçonneuses : guide + chaîne protégée |
| Engins portés | Rampes homologuées, frein engin | 4 points d'arrimage minimum |

---

## 5. Matériel thermique (essence / diesel)

### 5.1 Tondeuses thermiques

#### Composants critiques

| Composant | Symptôme défaillance | Entretien préventif |
|-----------|---------------------|---------------------|
| Lame | Tonte irrégulière, herbe déchirée | Affûtage 20–25 h, remplacement si usée |
| Courroie | Crissement, perte puissance | Tension, remplacement annuel |
| Filtre air | Perte puissance, surconsommation | Nettoyage 25 h, remplacement 100 h |
| Bougie | Démarrage difficile | Contrôle / remplacement saisonnier |
| Carter | Fuite huile | Joint, niveau huile moteur |

#### Protocole démarrage / arrêt

1. Vérifier `equipment.status` = `OK` dans Verdura.
2. Contrôle sécurité : OP (organes de coupe) fonctionnel, carter intact.
3. Remplir carburant **moteur arrêté**, zone ventilée.
4. Démarrage : jamais en espace confiné (CO mortel).
5. Arrêt : laisser ralenti 2 min avant coupure (refroidissement).
6. Nettoyage carter, contrôle lame, noter heures si fin de chantier.

> **Danger CO :** ne jamais faire tourner un moteur thermique en atelier fermé sans extraction.

### 5.2 Débroussailleuses thermiques

| Élément | Spécification |
|---------|---------------|
| **Fil / lame** | Fil 2,4–3,3 mm selon végétation ; lame 3 dents pour broussailles |
| **Carburant** | Mélange 2 % (50:1) ou huile 4 temps selon modèle |
| **EPI** | Jambières, casque visière, gants anti-coupure, bouchons |
| **Zone de sécurité** | 15 m minimum autour de l'opérateur |
| **Interdit** | Fil métallique, travail par temps sec extrême (incendie) |

**Check-list avant usage :**

- [ ] Fil ou lame adapté à la végétation
- [ ] Protecteur de fil intact
- [ ] Poignée et harnais dorsal réglés (modèle dorsal)
- [ ] Réservoir sans fuite
- [ ] `internal_id` vérifié — pas d'alerte `v_equipment_alerts`

### 5.3 Tronçonneuses thermiques

> **Matériel à risque majeur.** Formation obligatoire. Port EPI complet non négociable.

| Contrôle | Fréquence | Action si KO |
|----------|-----------|--------------|
| Chaîne affûtée | Avant chaque journée | Affûtage ou remplacement |
| Tension chaîne | Avant démarrage | Réglage — chaîne ni trop lâche ni trop tendue |
| Frein chaîne | Chaque démarrage | **Stop** — maintenance immédiate |
| Guide / chaîne | Visuel | Remplacer si usure > 30 % |
| Anti-vibration | Mensuel | Remplacement tampons |
| Filtre air | 25 h | Nettoyage / remplacement |

**Technique de coupe sécurisée :**

1. Position stable, pieds écartés, plan d'échappement.
2. Pas de coupe au-dessus des épaules sans formation spécifique.
3. Utiliser le taquet (felling dog) pour abattage.
4. Anticiper le barreau de chute (entaille + coupe de felling).
5. Jamais de coupe avec bout de guide (rebond / kickback).

**Signalement Verdura :** tout incident (kickback, casse chaîne, blessure) → `anomalies` avec `priority` = `urgente` + `equipment_id`.

### 5.4 Taille-haies thermiques

| Paramètre | Valeur |
|-----------|--------|
| Lames | Affûtées, graissées |
| Portée perche | Vérifier verrouillage extension |
| EPI | Casque visière, gants, bouchons |
| Interdit | Taille au-dessus de la hauteur d'épaules sans plateforme |

### 5.5 Tracteurs et engins autoportés lourds

| Système | Contrôle quotidien | Maintenance |
|---------|-------------------|-------------|
| Hydraulique | Fuites, niveau huile | Selon constructeur |
| Attelage 3 points | Goupilles, verrous | Graissage |
| ROPS / cabine | Structure intacte | Ne jamais modifier |
| Pneus / chenilles | Pression, usure | Rotation, remplacement |
| Organes de coupe | Lames, broyeurs | Affûtage, équilibrage |

> **ROPS :** ne jamais utiliser un tracteur sans cabine/ROPS homologué sur terrain accidenté. Ceinture attachée si cabine.

---

## 6. Matériel électrique et batterie

### 6.1 Avantages et contraintes

| Avantage | Contrainte |
|----------|------------|
| Bruit réduit (zones sensibles) | Autonomie limitée |
| Zéro émission locale | Temps de charge |
| Entretien réduit (pas bougie/filtre air) | Coût batteries, stockage hiver |
| Acceptation urbaine | Sensibilité humidité / pluie |

### 6.2 Gestion des batteries

**Check-list charge :**

- [ ] Chargeur adapté au modèle (voltage correct)
- [ ] Charge en zone ventilée, hors gel
- [ ] Câbles et connecteurs propres, secs
- [ ] Ne pas charger batterie endommagée (fuite, gonflement)
- [ ] Stockage hiver : 40–60 % charge, lieu sec 10–25 °C

> **Danger :** batteries lithium — ne pas percer, écraser, exposer à > 60 °C. Incendie batterie : extincteur classe D ou eau abondante selon procédure interne.

### 6.3 Matériel électrique par catégorie

| Matériel | Autonomie type | Entretien spécifique |
|----------|---------------|---------------------|
| Tondeuse batterie | 400–800 m²/charge | Lame, nettoyage carter, firmware |
| Débroussailleuse batterie | 30–60 min | Tête fil, moteur sans balais |
| Tronçonneuse batterie | 150–300 coupes | Huile chaîne, tension |
| Souffleur batterie | 20–40 min | Turbine, filtres |
| Taille-haie batterie | 45–90 min | Lames, alignement |

### 6.4 Utilisation par conditions météo

| Condition | Thermique | Électrique |
|-----------|-----------|------------|
| Pluie légère | Possible avec EPI | Éviter — étanchéité limitée |
| Sol détrempé | Risque ornières | Poids réduit — avantage |
| Canicule | Surchauffe moteur | Surveiller batterie (perte autonomie) |
| Gel | Antigel carburant (2T) | Batterie en intérieur la veille |

---

## 7. Entretien préventif et curatif

### 7.1 Logique Verdura — Heures machine

La vue **`v_equipment_alerts`** remonte les équipements où :

```sql
status = 'En panne'
   OR (hours_used >= hours_for_maintenance AND is_archived = false)
```

| Paramètre | Champ | Exemple |
|-----------|-------|---------|
| Heures cumulées | `hours_used` | 98 h |
| Seuil révision | `hours_for_maintenance` | 100 h |
| → Alerte | `v_equipment_alerts` | Maintenance préventive à planifier |

**À la clôture chantier (`finish_task`) :** la durée intervention est ajoutée à `hours_used`. Si seuil atteint → `status` passe à **`Maintenance requise`**.

### 7.2 Plan de maintenance préventive — Grille type

| Intervalle | Opérations | Matériel concerné |
|------------|------------|-------------------|
| **Quotidien** | Contrôle visuel, sécurité OP, nettoyage basique | Tous |
| **25 h** | Filtre air, graissage, tension courroie | Thermiques |
| **50 h** | Affûtage lame/chaîne, bougie, filtre carburant | Tondeuses, tronçonneuses |
| **100 h** | Révision générale, vidange, courroies | Autoportées, tracteurs |
| **250 h** | Révision majeure, embrayage, hydraulique | Engins lourds |
| **Annuel** | Contrôle véhicule (CT si applicable), EPI | Véhicules, EPI |

### 7.3 Enregistrement `maintenance_logs`

| Champ | Contenu recommandé |
|-------|-------------------|
| `equipment_id` | Machine concernée |
| `type` | `Révision 100h`, `Remplacement lame`, `Réparation frein chaîne` |
| `cost` | Coût pièces + MO |
| Date | Auto `created_at` |

**Check-list après maintenance :**

- [ ] Saisir `maintenance_logs`
- [ ] Remettre `equipment.status` = `OK`
- [ ] Réinitialiser ou ajuster `hours_for_maintenance` si révision majeure
- [ ] Clôturer `anomalies` liées si résolues (`resolved = true`)
- [ ] Tester machine 5 min avant remise en service

### 7.4 Stock pièces détachées recommandé

| Pièce | Quantité min. | Matériel |
|-------|---------------|----------|
| Lames tondeuse | 2 / modèle | Tondeuses |
| Chaînes tronçonneuse | 2 / pas | Tronçonneuses |
| Fils débroussailleuse | 20 bobines | Débroussailleuses |
| Bougies | 2 / modèle moteur | Thermiques |
| Filtres air / carburant | 1 / modèle | Thermiques |
| Courroies | 1 / modèle | Autoportées |
| Batterie secours | 1 | Outillage électrique critique |

---

## 8. Anomalies et pannes — Procédure Verdura

### 8.1 Table `anomalies` — Champs clés

| Champ | Usage |
|-------|-------|
| `equipment_id` | Machine concernée (obligatoire si panne matériel) |
| `task_id` | Chantier en cours si applicable |
| `reported_by` | Agent signaleur (`profiles.id`) |
| `description` | Symptôme, circonstances, photo si possible |
| `priority` | `normale` · `haute` · `urgente` |
| `resolved` | `false` → ouverte ; `true` → clôturée |

### 8.2 Grille de priorité

| Priorité | Situation | Délai traitement | Exemple |
|----------|-----------|------------------|---------|
| **`urgente`** | Danger immédiat, blessure, incendie | Immédiat | Kickback tronçonneuse, fuite carburant majeure |
| **`haute`** | Machine immobilisée, chantier bloqué | < 24 h | Panne autoportée en période tonte |
| **`normale`** | Dégradation sans blocage immédiat | < 72 h | Poignée cassée, vibration anormale |

### 8.3 Check-list signalement anomalie (agent)

- [ ] Sécuriser la zone et l'engin (couper contact, caler)
- [ ] Ne pas forcer une machine en panne
- [ ] Créer anomalie dans Verdura (`/anomalies`)
- [ ] Renseigner `equipment.internal_id` dans la description
- [ ] Joindre photo si possible (Storage `task-media`)
- [ ] Prévenir coordinateur si `urgente`
- [ ] Demander matériel de remplacement via `task_equipment` sur autre engin

> **Agent IA :** question type « La tondeuse TND-03 fume » → vérifier `v_equipment_alerts`, guider création `anomalies`, rappeler interdiction d'usage si `En panne`.

---

## 9. Consignes de sécurité générales

### 9.1 Principes non négociables

1. **Utiliser uniquement du matériel en statut `OK`** (sauf dérogation écrite coordinateur).
2. **EPI adaptés** portés en permanence sur zone de travail.
3. **Formation préalable** obligatoire pour tronçonneuse, débroussailleuse, tracteur, phyto.
4. **Signalisation** des zones de travail (balisage, cones) en présence de public.
5. **Arrêt d'urgence** : tout agent peut stopper un chantier dangereux.

### 9.2 Distances de sécurité

| Activité | Distance minimum public / tiers |
|----------|--------------------------------|
| Tonte / autoportée | 15 m |
| Débroussailleuse | 15 m |
| Tronçonneuse | 20 m |
| Pulvérisation phyto | 5 m (non applicateurs), respect ZNT |
| Souffleur | 10 m (projection) |

### 9.3 Produits phytosanitaires et matériel

| Règle | Détail |
|-------|--------|
| Pulvérisateur dédié | Jamais réutilisé pour arrosage potager |
| Nettoyage triple rinçage | Obligatoire après traitement |
| Stockage | Local ventilé, verrouillé, bac retention |
| Traçabilité | `task_products` + `products.amm_number` |
| EPI phyto | Combinaison, gants nitrile, masque FFP3 selon FDS |

> **Contamination :** en cas de contact produit concentré — retirer vêtements, douche immédiate, alerter coordinateur, fiche toxicologique (numéro sur FDS).

### 9.4 Travail isolé

| Situation | Mesure |
|-----------|--------|
| Agent seul en zone boisée | Pointage radio / téléphone, horaire connu |
| Tronçonneuse en forestier | **Interdit seul** — binôme minimum |
| Canicule | Pauses hydratation, horaires décalés |
| Nuit / visibilité réduite | Éclairage, gilet haute visibilité |

---

## 10. Équipements de Protection Individuelle (EPI)

### 10.1 Matrice EPI par activité

| Activité | Casque / visière | Lunettes | Bouchons / casque antibruit | Gants | Jambières | Chaussures | Combinaison | Gilet HV |
|----------|:----------------:|:--------:|:---------------------------:|:-----:|:---------:|:----------:|:-----------:|:--------:|
| Tonte | — | ✅ | ✅ (autoportée) | ✅ | — | S3 | — | ✅ |
| Débroussailleuse | ✅ visière | ✅ | ✅ | anti-coupure | ✅ | S3 | — | ✅ |
| Tronçonneuse | ✅ visière | ✅ | ✅ | anti-coupure | ✅ | S3 | — | ✅ |
| Taille-haie | ✅ | ✅ | ✅ | ✅ | — | S3 | — | ✅ |
| Pulvérisation phyto | ✅ | ✅ | selon FDS | nitrile | — | S3 | ✅ étanche | ✅ |
| Conduite engin | — | — | ✅ cabine | ✅ | — | S3 | — | ✅ |
| Véhicule route | — | — | — | — | — | S3 | — | ✅ |

**Normes indicatives :** EN 397 (casque), EN 352 (audition), EN 388 (gants), EN ISO 20345 S3 (chaussures), EN 17353 (HV).

### 10.2 Check-list EPI — Départ matin

- [ ] EPI propres et en bon état (pas de déchirure combinaison phyto)
- [ ] Casque antibruit / bouchons disponibles
- [ ] Gants adaptés à la tâche du jour
- [ ] Chaussures de sécurité S3 lacées
- [ ] Gilet haute visibilité pour zones route / public
- [ ] EPI phyto en sachet séparé si traitement prévu

### 10.3 Entretien EPI

| EPI | Entretien | Remplacement |
|-----|-----------|--------------|
| Casque | Nettoyage, pas de peinture | Choc ou > 5 ans |
| Gants anti-coupure | Pas de lavage agressif | Trou ou perte protection |
| Combinaison phyto | Lavage séparé, stockage hors sac | Contamination répétée |
| Chaussures S3 | Séchage, contrôle semelle | Semelle usée, coque exposée |

---

## 11. Affectation matériel ↔ chantiers

### 11.1 Table `task_equipment`

Lors de la planification d'un chantier (`tasks`), le coordinateur associe le matériel nécessaire :

| Type chantier (`tasks.title`) | Matériel typique | Vérification |
|------------------------------|------------------|--------------|
| Tonte pelouse | Tondeuse autoportée ou push | Lame, `status` OK |
| Taille haie | Taille-haie + remorque déchets | Lames, perche |
| Débroussaillage | Débroussailleuse + EPI complet | Fil, jambières |
| Élagage N1 | Tronçonneuse + EPI | Frein chaîne |
| Traitement phyto | Pulvérisateur + EPI phyto | Étanchéité, rinçage |
| Évacuation déchets | Véhicule benne + remorque | PTAC, arrimage |

### 11.2 Check-list coordinateur — Affectation flotte

- [ ] Consulter `v_equipment_alerts` — aucune alerte sur engins planifiés
- [ ] Vérifier `equipment.team` cohérent avec `tasks.team`
- [ ] Confirmer `assigned_to` ou réaffecter si agent absent
- [ ] Lier `task_equipment` avant `status` → `en_cours`
- [ ] Prévoir engin de secours si chantier critique (`priority` haute)

---

## 12. Hivernage et remise en service

### 12.1 Hivernage (novembre–février)

| Matériel | Opération |
|----------|-----------|
| Tondeuses thermiques | Vidange carburant ou stabilisant, vidange huile, bougie déconnectée |
| Tronçonneuses | Reservoir vide, guide-chaîne graissé, étui |
| Batteries | Charge 40–60 %, stockage 10–25 °C |
| Pulvérisateurs | Triple rinçage, séchage, stockage hors gel |
| Véhicules | Contrôle liquides, pneus, CT si échéance |

### 12.2 Remise en service (mars)

- [ ] Contrôle sécurité OP sur toutes machines
- [ ] Huile, carburant, bougies si thermique
- [ ] Affûtage lames et chaînes
- [ ] Mise à jour `equipment.status` = `OK` dans Verdura
- [ ] Test 5 min par machine avant affectation chantier

---

## 13. Check-lists de contrôle périodique

### 13.1 Contrôle hebdomadaire parc (coordinateur)

- [ ] Requête `v_equipment_alerts` — planifier maintenances
- [ ] Anomalies ouvertes (`resolved = false`) — prioriser `urgente` / `haute`
- [ ] Cohérence `hours_used` vs carnets terrain
- [ ] Disponibilité engins de substitution par équipe
- [ ] Stock pièces critiques

### 13.2 Contrôle mensuel sécurité

- [ ] État EPI par équipe
- [ ] Extincteurs véhicules et atelier
- [ ] Local phyto (confinement, signalétique)
- [ ] Registre maintenance à jour (`maintenance_logs`)
- [ ] Retour expérience incidents (réunion courte)

### 13.3 Contrôle avant utilisation (agent — quotidien)

- [ ] `internal_id` correspond à la machine prise
- [ ] `equipment.status` = `OK`
- [ ] Organes de coupe et sécurité fonctionnels
- [ ] Niveaux (carburant, huile, batterie)
- [ ] EPI complets et adaptés
- [ ] Zone de travail balisée si public

---

## 14. Lexique agent IA Verdura — Matériel

| Question utilisateur | Source BDD | Requête / logique |
|---------------------|------------|-------------------|
| « Quels engins en panne ? » | `equipment`, `v_equipment_alerts` | `status = 'En panne'` |
| « Alertes maintenance ? » | `v_equipment_alerts` | Vue directe |
| « Où est la tondeuse 001 ? » | `equipment.internal_id` | Filtre `internal_id` |
| « Matériel équipe Nord ? » | `equipment.team` | Filtre team |
| « Historique entretien TND-02 ? » | `maintenance_logs` | Join `equipment_id` |
| « Anomalies ouvertes ? » | `anomalies` | `resolved = false` |
| « Quel matériel sur C2024-08 ? » | `task_equipment` | Join `tasks.project_number` |

---

## 15. Contacts et escalade

| Niveau | Rôle Verdura | Action |
|--------|--------------|--------|
| 1 | Agent | Signalement `anomalies`, arrêt sécurité |
| 2 | Coordinator | Planification maintenance, remplacement engin |
| 3 | Admin | Budget pièces, renouvellement parc, assurance |
| Urgence vitale | — | 15 (SAMU) / 18 (Pompiers) — puis signalement interne |

---

## 16. Références

| Sujet | Référence |
|-------|-----------|
| Utilisation équipements | Code du travail, R.4323-63 et suiv. |
| EPI | Décret 2008-244, normes EN |
| Phyto | Certiphyto, FDS produits |
| Circulation engins | Code de la route (engins non routiers) |
| Verdura technique | `docs/AUDIT_APPLICATION_VERDURA.md` §3 |

---

*Document maintenu par l'équipe Verdura. Pour les protocoles végétaux (taille, tonte, diagnostic), voir `docs/REFERENTIEL_ESPACES_VERTS.md`.*
