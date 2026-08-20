# Référentiel Espaces Verts — Bible Verdura

> **Version :** 1.0 — 20 août 2026  
> **Public :** jardiniers, chefs de secteur, coordinateurs, agent IA Verdura  
> **Complément technique :** `docs/AUDIT_APPLICATION_VERDURA.md`, `docs/REFERENTIEL_MATERIEL_VEHICULES.md`

---

## 1. Objet et périmètre

Ce document constitue la **bible métier végétale** du projet Verdura. Il regroupe les connaissances nécessaires pour :

- planifier et exécuter des **interventions** sur le terrain ;
- reconnaître les végétaux, diagnostiquer les problèmes et appliquer les **protocoles** adaptés ;
- alimenter l'**agent IA Verdura** avec un vocabulaire cohérent et des réponses actionnables.

> **Limite actuelle Verdura :** il n'existe pas encore de table « patrimoine arboré » ou « inventaire végétal ». L'unité opérationnelle reste le **chantier** (`tasks`). Les informations botaniques se documentent dans `tasks.notes`, les photos dans `tasks.photo_before_url` / `photo_after_url`, et les traitements phyto dans `task_products`.

---

## 2. Lien avec la base de données Verdura

### 2.1 Entités concernées

| Entité Verdura | Table / champ | Usage métier espaces verts |
|----------------|---------------|----------------------------|
| **Chantier / intervention** | `tasks` | Unité centrale : taille, tonte, plantation, traitement |
| **Référence chantier** | `tasks.project_number` | Ex. `C2024-01` — identifiant métier à citer en communication |
| **Client / site** | `tasks.client`, `tasks.address`, `tasks.lat`, `tasks.lng` | Localisation du patrimoine entretenu |
| **Équipe** | `tasks.team` | Équipe responsable (texte, lié à `teams.name`) |
| **Statut** | `tasks.status` | `planifie` · `en_cours` · `termine` · `annule` |
| **Priorité** | `tasks.priority` | `normale` · `haute` · `urgente` |
| **Notes terrain** | `tasks.notes` | Observations botaniques, espèces, contraintes |
| **Météo sèche requise** | `tasks.requires_dry_weather` | Traitements phyto, fauchage en conditions humides |
| **Alerte météo** | `tasks.weather_alert_status`, `tasks.actual_weather` | Report ou validation d'intervention |
| **Produits appliqués** | `task_products` + `products` | Traçabilité phyto (AMM, lot, dose/m²) |
| **Matériel mobilisé** | `task_equipment` + `equipment` | Tondeuse, tailleuse, pulvérisateur… |
| **Anomalie liée** | `anomalies` | Dégât végétal causé par matériel, incident sécurité |

### 2.2 Typologie d'interventions → titres de chantier recommandés

| Type d'intervention | Exemple `tasks.title` | Durée indicative (`duration`, h) |
|---------------------|----------------------|----------------------------------|
| Tonte pelouse | Tonte — Parc Central secteur A | 2–4 |
| Taille haie | Taille haie laurier — Clôture nord | 3–6 |
| Taille arbustes | Taille massif arbustes — Entrée mairie | 4–8 |
| Taille arbre | Taille jeune arbre — Alignement rue X | 2–4 |
| Débroussaillage | Débroussaillage talus — Lotissement Y | 4–8 |
| Plantation | Plantation arbres — Allée des tilleuls | 6–8 |
| Traitement phyto | Traitement mouche du cerisier — Vergers | 2–3 |
| Fertilisation | Apport engrais pelouse — Stade | 2–4 |
| Ramassage déchets verts | Évacuation branches — Chantier C2024-12 | 2–6 |
| Entretien massifs | Désherbage manuel — Massif fleuri | 4–8 |

> **Bonnes pratiques Verdura :** renseigner `tasks.notes` avec espèce dominante, surface approximative (m²), stade phénologique et contraintes d'accès. Joindre une photo avant (`photo_before_url`) pour les interventions sensibles (taille arbre, traitement phyto).

---

## 3. Patrimoine végétal — Typologie et classification

### 3.1 Niveaux de patrimoine (concept métier)

| Niveau | Description | Exemple | Priorité entretien |
|--------|-------------|---------|-------------------|
| **Patrimoine remarquable** | Arbres classés, arbres d'alignement historiques, arbres centenaires | Chêne centenaire, tilleul d'allée | Très haute — validation coordinateur |
| **Patrimoine structurant** | Haies bocagères, bosquets, alignements, parcs | Haie de charme, alignement platanes | Haute |
| **Patrimoine fonctionnel** | Pelouses sportives, massifs d'accueil, rocailles | Pelouse stade, massif entrée | Normale à haute |
| **Patrimoine temporaire** | Plantations récentes (< 3 ans), végétation provisoire | Arbres jeunes, massifs annuels | Normale — suivi renforcé |
| **Végétation spontanée** | Friches, talus, bords de cours d'eau | Ronce, repousses | Variable selon contrat |

### 3.2 Classification fonctionnelle des espaces

| Catégorie | Caractéristiques | Interventions principales |
|-----------|------------------|---------------------------|
| **Pelouse fine** | Gazon anglais, fescue, faible piétinement | Tonte haute fréquence, scarification, aération |
| **Pelouse utilitaire** | Mélange résistant, piétinement modéré | Tonte régulière, fertilisation légère |
| **Pelouse sportive** | Rye-grass, usure intense | Tonte basse, fertilisation, overseeding |
| **Massif arbustif** | Couverture sol, structure permanente | Taille de formation, taille d'entretien |
| **Massif vivace / annuel** | Saisonnalité, esthétique | Plantation, désherbage, division |
| **Haie** | Linéaire, fonction écran / clôture | Taille 1–2×/an, respect période légale |
| **Arbre d'ornement** | Isolé ou alignement | Taille raisonnée, surveillance sanitaire |
| **Arbre fruitier** | Vergers collectifs, jardins partagés | Taille fructification, traitements ciblés |
| **Zone naturelle** | Fauche tardive, gestion différenciée | Fauchage sélectif, pas de tonte intensive |

### 3.3 Fiche patrimoine végétal (modèle à consigner dans `tasks.notes`)

```markdown
## Patrimoine — [Nom site / client]
- Surface totale : ___ m²
- Espèce(s) dominante(s) : ___
- Âge / stade : jeune | adulte | sénescent
- Contraintes : accès engin | proximité réseaux | public | période nidification
- Dernière intervention : [date] — [type]
- Observations sanitaires : ___
```

---

## 4. Reconnaissance végétale — Guide terrain

### 4.1 Arbres — Clés de reconnaissance

| Groupe | Feuillage | Écorce / Port | Espèces fréquentes en collectivité |
|--------|-----------|---------------|-----------------------------------|
| **Feuillus caduc** | Feuilles larges, chute automne | Variable | Érable, tilleul, chêne, platane, bouleau |
| **Feuillus persistants** | Feuilles coriaces toute l'année | Dense | Chêne vert, houx, laurier-cerise |
| **Conifères** | Aiguilles / écailles | Résineux | Pin sylvestre, thuya, cyprès, sapin |
| **Palmiers / exotiques** | Palmes ou feuilles tropicales | Sud / urbain | Palmier, mimosa, olivier |

**Critères d'identification rapide :**

- [ ] Forme générale (port érigé, étalé, pleureur)
- [ ] Type de feuille (simple / composée, lobée, dentée)
- [ ] Disposition des feuilles (alterne / opposée)
- [ ] Écorce (lisse, fissurée, écaillante)
- [ ] Fruits / fleurs / cônes visibles
- [ ] Odeur au froissement (laurier, noyer…)

> **Attention :** ne jamais confondre **laurier-cerise** (*Prunus laurocerasus*, toxique) et **laurier vrai** (*Laurus nobilis*, comestible). En cas de doute, ne pas consommer et consulter le coordinateur.

### 4.2 Arbustes et haies — Espèces courantes

| Espèce | Feuillage | Taille recommandée | Particularités |
|--------|-----------|-------------------|----------------|
| **Laurier-cerise** | Persistant, luisant | 2×/an (printemps, fin été) | Croissance rapide, toxique |
| **Thuya** | Persistant, écailles | 1–2×/an | Sensibilité sécheresse |
| **Charme / hêtre** | Caduc / semi-persistant | 1×/an | Haies champêtres |
| **Bambou** | Persistant | Containment obligatoire | Invasif — barrière rhizome |
| **Fusain** | Caduc | 1–2×/an | Facile, bonne reprise |
| **Photinia** | Persistant, rouge jeune | 2×/an | Esthétique massifs |
| **Olivier** | Persistant | Légère annuelle | Sud, gel possible |

### 4.3 Vivaces, annuelles et couvre-sol

| Type | Exemples | Entretien clé |
|------|----------|---------------|
| **Couvre-sol** | Ajuga, sedum, pervenche | Désherbage ponctuel, division |
| **Vivaces hautes** | Delphinium, echinacea, rose | Taille sécher, division tous les 3–5 ans |
| **Annuelles** | Pétunia, bégonia, cosmos | Plantation printemps, arrosage |
| **Bulbeuses** | Narcisse, tulipe, crocus | Laisser faner feuilles avant taille |

### 4.4 Pelouses — Identification des graminées dominantes

| Espèce / mélange | Aspect | Usage | Hauteur tonte (cm) |
|------------------|--------|-------|-------------------|
| **Ray-grass anglais** | Dense, vert vif | Sport, utilitaire | 25–35 |
| **Fescue fine** | Fin, exigeante | Ornement | 30–40 |
| **Pâturin commun** | Touffes, robuste | Polyvalent | 30–40 |
| **Trèfle blanc** | Fixateur azote | Pelouse bas entretien | 40–50 |
| **Mélange fleuri** | Diversité | Gestion différenciée | Fauche tardive (juin–sept.) |

---

## 5. Diagnostic végétal — Symptômes, causes, actions

### 5.1 Matrice diagnostic rapide

| Symptôme visible | Causes probables | Action immédiate | Chantier Verdura suggéré |
|------------------|------------------|------------------|--------------------------|
| Jaunissement général | Carence azote, excès eau, racines compactées | Analyser sol, vérifier drainage | Fertilisation / aération pelouse |
| Taches brunes foliaires | Maladie fongique (rhytisme, oïdium) | Retirer débris, éviter arrosage feuillage | Traitement phyto si justifié |
| Défoliation précoce | Stress hydrique, maladie, ravageur | Arrosage profond, inspection | Taille sanitaire |
| Galeries sous écorce | Scolytes, capricornes | Isoler arbre, évaluer risque chute | Signalement patrimoine remarquable |
| Mousse / lichen pelouse | Sol compact, faible luminosité, pH acide | Scarification, aération, chaux si besoin | Entretien pelouse |
| Désherbage insuffisant | Compétition adventices | Désherbage manuel / thermique | Désherbage massif |
| Flétrissement soudain | Verticilliose, pourriture racinaire | Pas de replantation immédiate même famille | Abattage / remplacement planifié |

### 5.2 Maladies fréquentes — Fiches synthèse

#### Oïdium (poudre blanche)

| Élément | Détail |
|---------|--------|
| **Hôtes** | Rosiers, tilleuls, cépages, cucurbitacées |
| **Conditions** | Humidité, chaleur, mauvaise aération |
| **Symptômes** | Feutrage blanc sur feuilles, déformation |
| **Prévention** | Taille aérante, éviter arrosage feuillage |
| **Traitement** | Produit homologué — voir `products` (catégorie Phyto, `amm_number`) |
| **Verdura** | Créer chantier traitement + `task_products` (lot, dose/m²) |

#### Rhytisme (taches foliaires)

| Élément | Détail |
|---------|--------|
| **Hôtes** | Platanes, érables, pelouses |
| **Symptômes** | Taches brunes angulaires, chute prématurée |
| **Prévention** | Ramassage feuilles mortes, bonne aération |
| **Traitement** | Fongicide si seuil dépassé — respecter période |

#### Chancre bactérien

| Élément | Détail |
|---------|--------|
| **Hôtes** | Rosiers, pommiers, pruniers |
| **Symptômes** | Lésions noires, suintement, flétrissement rameaux |
| **Action** | Taille sanitaire 20 cm sous lésion, désinfection outils |
| **Verdura** | Documenter dans `tasks.notes` + photos avant/après |

### 5.3 Ravageurs courants

| Ravageur | Signes | Période critique | Action |
|----------|--------|------------------|--------|
| **Puceron** | Colonies vertes/noires, feuilles enroulées | Printemps–été | Savon noir, auxiliaires, traitement ciblé |
| **Chenilles processionnaires** | Processions au sol, dents urticantes | Hiver–printemps | Piégeage, destruction nids — **EPI obligatoire** |
| **Scolytes** | Sciure, petits trous écorce | Printemps–été | Abattage sanitaire si colonisation |
| **Limace / escargot** | Défoliation jeunes plants | Humide | Pièges, barriers, main si faible |
| **Mouche du cerisier** | Fruits vermoulus | Floraison | Traitement au bon stade (BBCH) |
| **Vers blancs (larves)** | Pelouse arrachée en plaques | Automne–printemps | Traitement biologique (nématodes) |

> **Réglementation phyto :** tout traitement doit être tracé dans Verdura via `task_products` (produit, `lot_number`, `dose_per_m2`, chantier lié). Vérifier `tasks.requires_dry_weather` avant application.

### 5.4 Carences nutritives

| Carence | Symptôme | Élément | Correction |
|---------|----------|---------|------------|
| Azote (N) | Jaunissement uniforme, croissance faible | Engrais azoté | `products` catégorie Engrais |
| Phosphore (P) | Coloration violette, racines faibles | Engrais P | Apport automne/printemps |
| Potassium (K) | Bordures brunes, sensibilité gel | Engrais K | Apport automne |
| Fer (Fe) | Chlorose inter-nervaire | Chélates fer | Traitement foliaire |
| Magnésium (Mg) | Jaunissement vieilles feuilles | Sulfate magnésie | Apport ponctuel |

---

## 6. Protocoles de taille

### 6.1 Principes généraux

1. **Taille raisonnée** — respecter la physiologie de l'espèce et la réglementation locale.
2. **Périodes légales** — en France, respecter l'arrêté préfectoral sur la destruction de nids et la période de nidification (15 mars – 15 août : prudence maximale).
3. **Outils propres** — désinfection entre sujets sensibles (chancre, verticilliose).
4. **EPI** — gants, lunettes, casque antibruit, protection auditive (voir référentiel matériel).

> **Interdiction absolue :** taille en hauteur sans formation ETPI (Élagage Travaux en Hauteur). Signaler tout besoin d'intervention spécialisée au coordinateur.

### 6.2 Taille de haie — Protocole standard

**Période :** hors nidification si possible ; 1ère taille fin printemps, 2ème fin été (persistants).

**Check-list avant intervention :**

- [ ] Vérifier `tasks.priority` et accès (`address`, `lat`/`lng`)
- [ ] Contrôler matériel : `task_equipment` — taille-haie OK (`equipment.status`)
- [ ] Baliser zone si passage public
- [ ] Vérifier absence nid visible
- [ ] Photo avant (`photo_before_url`)

**Étapes :**

1. Définir la forme cible (trapèze : base plus large que sommet pour luminosité).
2. Taille du bas vers le haut — côtés puis dessus.
3. Ramassage et évacuation déchets verts.
4. Photo après + clôture chantier (`status` → `termine`).

| Type haie | Hauteur cible | Largeur | Fréquence |
|-----------|---------------|---------|-----------|
| Haie basse (< 1 m) | 0,6–0,8 m | 40–50 cm | 2×/an |
| Haie moyenne (1–2 m) | 1,5–1,8 m | 50–70 cm | 1–2×/an |
| Haie haute (> 2 m) | Selon contrat | 60–80 cm | 1×/an |

### 6.3 Taille arbustes en massif

| Stade | Objectif | Technique |
|-------|----------|-----------|
| **Formation (années 1–3)** | Structure, équilibre | Suppression bois mort, 1/3 volume max/an |
| **Entretien** | Densité, floraison | Taille légère post-floraison si floraison sur bois ancien |
| **Rejuvenation** | Massif vieillissant | Taille drastique sur 3 ans (1/3/an) — validation coordinateur |

### 6.4 Taille arbre — Niveaux d'intervention

| Niveau | Contenu | Qui | Verdura |
|--------|---------|-----|---------|
| **N1 — Entretien courant** | Bois mort < 5 cm, gourmands bas tronc | Agent formé | Chantier standard |
| **N2 — Taille raisonnée** | Aération couronne, suppression branches gênantes | Agent qualifié élagage | `priority` haute si risque |
| **N3 — Élagage technique** | Gros bois, accès corde/nacelle | Entreprise certifiée ETPI | Hors périmètre agent — sous-traitance |

**Règles de coupe :**

- Collet de branche : ne pas laisser chicot, ne pas couper au ras du tronc.
- Diamètre max de coupe sans expertise : **5 cm** (N1).
- Ne jamais retirer plus de **25 %** du houppier en une seule intervention.

---

## 7. Protocoles de tonte et fauchage

### 7.1 Tonte pelouse — Protocole

**Fréquence indicative :**

| Saison | Pelouse fine | Pelouse utilitaire | Pelouse bas entretien |
|--------|--------------|--------------------|-----------------------|
| Printemps | 1×/semaine | 1×/10 jours | 1×/2 semaines |
| Été | 1×/semaine | 1×/semaine | 1×/2–3 semaines |
| Automne | 1×/10 jours | 1×/10 jours | 1×/3 semaines |
| Hiver | Selon croissance | Selon croissance | Rare |

**Check-list tonte :**

- [ ] Vérifier `equipment.status` = `OK` pour tondeuse assignée (`internal_id`)
- [ ] Contrôler `hours_used` vs `hours_for_maintenance` (alerte `v_equipment_alerts`)
- [ ] Parcourir le terrain : obstacles, déchets, présence public
- [ ] Ne pas tondre si sol détrempé (compaction + ornières)
- [ ] Respecter hauteur de coupe selon espèce (cf. §4.4)
- [ ] Ramasser ou broyer selon consigne client (noter dans `tasks.notes`)

**Technique :**

1. 1er passage en périphérie (contour).
2. Lignes parallèles, chevauchement 10 %.
3. Alterner sens de tonte chaque passage (éviter compaction).
4. Nettoyage carter + contrôle lame après chantier.

> **Météo Verdura :** si `requires_dry_weather = true` (traitement associé ou sol fragile), reporter si pluie ou `weather_alert_status` défavorable.

### 7.2 Fauchage différencié (zones fleuries / prairies)

| Paramètre | Valeur |
|-----------|--------|
| **Période** | Après floraison — souvent fin juin à septembre |
| **Hauteur de fauche** | 10–15 cm minimum |
| **Fréquence** | 1–2×/an selon contrat |
| **Matériel** | Faucheuse autoportée, débroussailleuse (`equipment.type`) |
| **Objectif** | Préserver biodiversité, éviter lignification |

---

## 8. Protocoles de soins — Arrosage, fertilisation, phyto

### 8.1 Arrosage

| Situation | Volume / fréquence | Verdura |
|-----------|-------------------|---------|
| **Plantation arbre** | 20–30 L 2×/semaine (été année 1) | Chantier « Arrosage plantation » |
| **Massif annuel** | Surface humide 10 cm, 2–3×/semaine été | Noter dans `tasks.notes` |
| **Pelouse établie** | 15–20 mm/semaine (pluie + arrosage) | Éviter arrosage nocturne prolongé |
| **Canicule** | Arrosage matin ou soir, paillage | `priority` haute si stress visible |

### 8.2 Fertilisation

| Type | Période | Produit Verdura (`products.category`) | Dose indicative |
|------|---------|--------------------------------------|-----------------|
| Engrais pelouse printemps | Mars–avril | Engrais | 30–40 g/m² |
| Engrais pelouse automne | Sept–oct | Engrais | 25–35 g/m² |
| Engrais arbustes | Fin hiver | Engrais | Selon étiquette |
| Amendement organique | Automne | Engrais / compost | 3–5 L/m² |

**Traçabilité :** enregistrer dans `task_products` : `product_id`, `quantity`, `lot_number`, `dose_per_m2`.

### 8.3 Phytosanitaire — Protocole réglementaire

**Avant tout traitement :**

- [ ] Produit homologué — vérifier `products.amm_number`
- [ ] Stock suffisant — `products.stock` > quantité prévue
- [ ] Conditions météo : vent < 19 km/h, pas de pluie 24 h, `requires_dry_weather` respecté
- [ ] EPI complets (cf. référentiel matériel)
- [ ] Balisage zone 24 h si nécessaire
- [ ] Registre phyto : saisie `task_products` obligatoire

| Catégorie `products` | Exemples d'usage | Précautions |
|----------------------|------------------|-------------|
| **Phyto** | Fongicide, insecticide, herbicide | Certiphyto, EPI, délais réentrée |
| **Engrais** | NPK, organique | Dosage, ruissellement |
| **Semences** | Regarnissage pelouse | Préparation sol, arrosage |

> **Interdit :** mélange de produits non prévu à l'étiquette ; traitement sans traçabilité Verdura ; dépassement dose `dose_per_m2`.

---

## 9. Calendrier annuel type (collectivité tempérée)

| Mois | Interventions prioritaires | Risques / vigilance |
|------|---------------------------|---------------------|
| **Janv.** | Taille fruitiers, planification | Gel, sol gelé |
| **Févr.** | Taille haies (selon météo), préparation matériel | Nidification approche |
| **Mars** | Début tonte, fertilisation pelouse, plantations | **15 mars — nidification** |
| **Avr.** | Tonte, désherbage, traitements préventifs | Pucerons, rhytisme |
| **Mai** | Taille post-floraison, entretien massifs | Chenilles, sécheresse |
| **Juin** | Fauche différenciée, arrosage | Canicule |
| **Juil.** | Tonte, arrosage, surveillance stress | **15 août — fin nidification** |
| **Août** | 2ème taille persistants, préparation automne | Canicule, incendie |
| **Sept.** | Scarification, sursemis, engrais automne | Reprise activité |
| **Oct.** | Plantation arbres, feuilles mortes | Humidité |
| **Nov.** | Taille sanitaire, protection jeunes plants | Gel |
| **Déc.** | Inventaire, entretien outils, planification N+1 | Intempéries |

---

## 10. Contraintes météo et sécurité terrain

### 10.1 Champs Verdura liés à la météo

| Champ | Valeur / usage | Action agent IA |
|-------|----------------|-----------------|
| `requires_dry_weather` | `true` | Ne pas planifier phyto / fauchage humide |
| `weather_alert_status` | Alerte active | Proposer report chantier |
| `actual_weather` | Constat terrain | Valider ou contester report |

### 10.2 Conditions d'arrêt d'intervention

> **Stop travail immédiat si :**
> - Orage ou éclair visible
> - Vent violent (> 40 km/h pour pulvérisation)
> - Sol impraticable (ornières, engins bloqués)
> - Présence nidification active non protégée
> - Accident ou malaise — alerter coordinateur

---

## 11. Check-lists par rôle

### 11.1 Agent / jardinier — Début de journée

- [ ] Consulter planning (`tasks` du jour, `task_assignments`)
- [ ] Vérifier alertes météo sur chantiers `requires_dry_weather`
- [ ] Contrôler matériel assigné (`equipment.internal_id`, `status`)
- [ ] Charger EPI et produits si traitement prévu
- [ ] Signaler anomalie matériel via `/anomalies` si besoin

### 11.2 Chef de secteur / coordinateur — Hebdomadaire

- [ ] Revue chantiers `en_cours` / `planifie` par équipe
- [ ] Prioriser `priority` = `urgente` ou `haute`
- [ ] Valider cohérence calendrier taille / nidification
- [ ] Contrôler traçabilité phyto (`task_products` vs chantiers traitement)
- [ ] Suivre patrimoine sensible (notes + photos avant/après)

### 11.3 Clôture chantier (`finish_task`)

- [ ] Photos avant/après si requis
- [ ] `tasks.notes` complétées (espèces, observations, incidents)
- [ ] Consommation produits saisie
- [ ] Heures matériel mises à jour (`hours_used`)
- [ ] Signature client si applicable (`signature_url`)
- [ ] Statut → `termine`

---

## 12. Lexique agent IA Verdura

| Terme métier | Correspondance BDD | Exemple de question utilisateur |
|--------------|-------------------|--------------------------------|
| Chantier | `tasks` | « Quels chantiers tonte demain ? » |
| N° projet | `tasks.project_number` | « Où en est le C2024-15 ? » |
| Client / site | `tasks.client` | « Interventions pour la Ville de X ? » |
| Traitement | `task_products` + `products` | « Quel AMM sur le dernier traitement ? » |
| Produit phyto | `products.amm_number` | « Stock herbicide disponible ? » |
| Équipe | `tasks.team` | « Planning équipe Nord cette semaine ? » |
| Anomalie terrain | `anomalies` | « Signaler dégât haie par engin » |

---

## 13. Références réglementaires et sources

| Sujet | Référence |
|-------|-----------|
| Nidification | Arrêté protection oiseaux — 15 mars au 15 août |
| Phytosanitaire | Code rural, Certiphyto, registre phytosanitaire |
| Taille arbres | Code forestier, PLU local, patrimoine arboré communal |
| Déchets verts | Traçabilité évacuation — noter dans `tasks.notes` |
| EPI | Code du travail, fiches FDS produits |

---

*Document maintenu par l'équipe Verdura. Pour les procédures matériel, flotte et sécurité machine, voir `docs/REFERENTIEL_MATERIEL_VEHICULES.md`.*
