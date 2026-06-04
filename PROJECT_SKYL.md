# 📝 RÉSUMÉ DU PROJET : Verdant Fleet

**Objectif :** Application de gestion d'interventions pour entreprises d'espaces verts, incluant la planification, le suivi terrain, la gestion des stocks et la comptabilité analytique.

## 🏗️ 1. Architecture & Infrastructure

*   **Runtime :** Migration vers **Bun** (`oven/bun:1.1-alpine`) pour la rapidité d'exécution et la gestion des dépendances.
*   **Docker :** Environnement stabilisé.
    *   **Ports :** L'application tourne sur le port `3000` (exposé via `--port 3000 --host 0.0.0.0` dans le Dockerfile).
    *   **Volume :** Isolation du dossier `node_modules` pour éviter les conflits entre Windows (Hôte) et Linux (Conteneur).
    *   **Hot-Reload :** Activation du *polling* (`CHOKIDAR_USEPOLLING=true`) dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\docker-compose.yml` pour garantir la détection des changements de fichiers sur Windows.
    *   **Layout & Navigation :** Implémentation d'une **Sidebar responsive** (`sidebar.tsx`) avec gestion du menu mobile et **badges de notification en temps réel** pour le matériel nécessitant une maintenance.
    *   **Procédure de mise à jour :** Pour appliquer les changements du `.env` ou des dépendances :
        ```bash
        docker-compose down
        docker-compose up --build -d
        ```
    *   **SSR & Stabilité :** Correction des erreurs d'hydratation (flicker) via des états `mounted` pour la lecture du `localStorage`. Résolution du conflit de type MIME pour Mapbox dans Docker.
    *   **Authentification :** Simplification de l'interface de connexion (retrait de l'OAuth GitHub) au profit d'un flux Email/Mot de passe robuste incluant désormais une procédure de **récupération de mot de passe oublié**.
*   **Client Supabase :** Configuration durcie dans `src/integrations/supabase/client.ts` avec détection des variables manquantes. Supporte les clés commençant par `eyJ` et gère la persistance de session.

## 🗄️ 2. Base de Données & Backend (Supabase)

*   **Schéma SQL (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_schema.sql`) :**
    *   Tables : `profiles`, `user_roles`, `tasks`, `products`, `equipment`, `anomalies`, `teams`, `suppliers`, `clients`, `purchase_orders`, `invoices`.
    *   Système **RBAC** : Rôles `agent`, `coordinator`, `admin`. Trigger `handle_new_user` pour la création automatique de profils à l'inscription.
    *   **Statut `annule` :** Ajouté à l'énumération `task_status` pour une meilleure traçabilité.
    *   **Priorité des tâches :** Ajout de la colonne `priority` (`normale`, `haute`, `urgente`) à la table `tasks`.
    *   **Gestion des équipes :** Table `teams` avec couleurs personnalisées et support du flag `is_archived` pour préserver l'historique sans encombrer le planning.
    *   **Gestion des Tiers :** Tables `suppliers` et `clients` incluant les coordonnées de contact (email, tel).
    *   **Row Level Security (RLS) :** Politiques activées pour isoler les données des agents (voient leurs tâches assignées) tout en permettant aux coordinateurs une visibilité globale.
    *   **Stockage Supabase :** Bucket `task-media` configuré avec RLS pour la gestion des photos de chantier (avant/après) et signatures client.
*   **Logique Métier (RPC) :**
    *   Implémentation de la fonction `finish_task` (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase\migrations\20260508090000_add_finish_task_rpc.sql`).
    *   Cette fonction atomique gère la clôture, l'enregistrement des notes/signatures, le calcul du coût de main-d'œuvre, la décrémentation des stocks et la **mise à jour automatique des compteurs d'heures du matériel** (incluant l'alerte de maintenance).
    *   **RPC `seed_demo_data` :** Fonction SQL permettant de générer instantanément des données de test liées à l'utilisateur connecté (rôles, profils, tâches, matériel).
    *   **Types TypeScript :** Synchronisation automatisée des types et enums via la CLI Supabase pour une sécurité accrue au build.

## 🎨 3. Fonctionnalités Frontend (React & TanStack)

*   **Gestion des Chantiers (Coordinator) :**
    *   Interface dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\coordinator-view.tsx`.
    *   **Unification CRUD :** Utilisation du composant réutilisable `TaskCreateDialog` incluant un **sélecteur de position sur carte** avec **géocodage inverse** (remplit l'adresse au clic) et bouton de géolocalisation.
    *   **Unification CRUD :** Utilisation du composant réutilisable `TaskCreateDialog` avec **sélecteur de position sur carte**, **géocodage inverse** (remplit l'adresse au clic) et **recherche textuelle d'adresse**.
    *   **Gestion visuelle des priorités :** Badges de couleur dynamiques et filtrage par priorité.
    *   **Dashboard Interactif :** Les cartes de résumé (Total, En cours, À venir) servent désormais de **filtres rapides** pour le tableau des tâches.
    *   **Expérience Utilisateur (UX) :** Intégration d'animations de **fondus enchaînés (fade-in) avec effet de décalage (stagger)** lors du filtrage ou du changement d'équipe pour une interface plus fluide.
    *   Filtrage dynamique par équipe (récupéré depuis la DB), recherche textuelle et export **CSV** pour le reporting (basé sur la liste filtrée).
    *   Gestion des suppressions et annulations d'interventions avec dialogues de confirmation.
    *   **Journal des Anomalies :** Nouvelle vue dédiée (`/anomalies`) permettant au coordinateur de consulter les pannes signalées par les agents, de les résoudre et de remettre le matériel en service (`status = OK`).
    *   Intégration de la `TaskDetailsSheet` pour consulter les preuves terrain (photos, produits, historique, **signature client**) incluant désormais un **bouton d'impression** pour générer des rapports PDF complets.
    *   Intégration de la `TaskDetailsSheet` avec **Timeline (Historique)** complète, affichage de la **signature client** et bouton d'**impression des rapports d'intervention**.
*   **Dashboard Coordinateur :**
    *   Migration complète vers Supabase (`coordinator-dashboard.tsx`).
    *   **Filtrage global :** Possibilité de filtrer l'intégralité des statistiques et graphiques par **Équipe** et par **Priorité**.
    *   Affichage des alertes maintenance basées sur `hours_used` et `hours_for_maintenance`.
    *   Graphiques de comptabilité analytique (Coût par site) et charge des équipes.
    *   Export du Registre Phytosanitaire en CSV.
*   **Workflow Terrain (Agent) :**
    *   Interface mobile-first dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\agent-supabase-view.tsx`.
    *   **Gestion avancée des médias :**
        *   **Compression côté client :** Réduction automatique du poids des images via Canvas API avant l'envoi pour économiser la bande passante.
        *   **Prévisualisation & Rotation :** Mode plein écran permettant de pivoter les photos mal orientées.
        *   **Éditeur d'annotations :** Outil de dessin intégré permettant d'ajouter des tracés à main levée, des cercles ou des flèches en rouge vif sur les photos avant validation.
    *   **Validation des stocks :** Vérification en temps réel pour empêcher de consommer plus que le stock disponible, avec feedback visuel.
    *   Clôture via l'appel RPC `finish_task` pour garantir l'atomicité.
    *   **Signalement d'anomalies :** Bouton d'urgence disponible sur les chantiers en cours pour déclarer une panne machine instantanément sans attendre la fin du chantier.
*   **Planning & Cartographie :**
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\planning-supabase-view.tsx` : Drag & Drop fonctionnel pour déplacer les chantiers.
    *   **Visualisation avancée :** Code couleur par équipe, icônes d'urgence (`Flame`), animations de pulsation pour les tâches critiques et légende des couleurs.
    *   **Flux guidé :** Message d'alerte et redirection si aucune équipe n'est configurée.
    *   **Smart Scheduling (OPÉRATIONNEL) :** Intégration de l'API OpenWeatherMap avec affichage d'icônes de prévision sur le **Planning**, la **Carte** et le **Détail des chantiers**. Système d'alerte visuelle (animation bounce et icône triangle) en cas de conflit météo.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\carte-supabase-view.tsx` : Intégration **Mapbox** optimisée. Persistance du token via `localStorage`. Initialisation de la carte en parallèle du chargement des données. **Géolocalisation en temps réel** ajoutée pour recentrer la carte sur la position de l'utilisateur. Affichage de la distance et du **temps de trajet estimé** vers le chantier le plus proche via l'API Mapbox Directions, avec un bouton "Itinéraire" pour lancer la navigation (Google Maps).
*   **Comptabilité & Stocks :**
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\settings-view.tsx` : 
        *   **Refonte Équipes :** Dialogue de configuration à deux colonnes (Membres / Matériel). Intégration du **Déboursé Sec** et calcul du **Prix de Vente (TTC)** basé sur des coefficients de frais généraux personnalisables par équipe.
        *   **Gestion du Parc :** Nouvel onglet pour le CRUD complet du matériel (ajout/édition/suppression de machines).
        *   **Collaborateurs :** Création manuelle sécurisée avec email pivot.
        *   **Sécurité & RH :** Système d'invitation avec génération de code, gestion du blocage des accès et procédure de réinitialisation de mot de passe via `/reset-password`.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\admin-analytics.tsx` : Tableaux de bord financiers avec **filtrage dynamique par équipe** et calcul automatique de la marge brute (Budget - [MO + Matériel + Produits]).
        *   **Analytique Avancée :** Passage du déboursé sec au **Prix de Revient** dans les graphiques pour une vision de la **Marge Nette** après frais de gestion.

## ️ 4. Gestion des Pannes & Maintenance Matériel

*   **Cycle de vie des Anomalies :**
    *   **Signalement (Agent) :** Interface simplifiée sur mobile permettant de déclarer une panne instantanément (bouton d'urgence). Le système lie automatiquement le chantier, l'équipement et l'agent rapporteur.
    *   **Résolution (Coordinateur) :** Journal centralisé (`/anomalies`) pour le suivi des réparations. La résolution d'une anomalie permet de basculer le matériel du statut "En panne" à "OK".
*   **Maintenance Préventive :**
    *   **Compteurs d'heures :** Incrémentation automatique via le RPC `finish_task` à la clôture de chaque intervention, basée sur la durée réelle du chantier.
    *   **Alertes intelligentes :** Notifications visuelles (badges et dashboard) dès que les heures d'utilisation (`hours_used`) approchent ou dépassent le seuil de maintenance (`hours_for_maintenance`).
*   **Impact Opérationnel :** Le matériel déclaré "En panne" est visuellement marqué dans les outils d'affectation pour éviter la planification de ressources indisponibles.

## 🛣️ 5. Routage & Structure

*   **TanStack Router :** Arbre de routes synchronisé (`routeTree.gen.ts`) incluant désormais `/coordinator`, `/analytics`, `/stocks`, and `/settings`.
*   **Layout Racine :** Gestion centralisée des erreurs et de l'authentification dans `__root.tsx`.
## 🧪 6. État des Données

*   **Mock Data :** Un script SQL de génération de données de test (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_mock_data.sql`) est prêt pour peupler l'inventaire, le matériel et les chantiers fictifs, permettant de tester toutes les fonctionnalités.

## 🚀 7. Workflow de Développement

*   **Branche Principale (`main`) :** Contient la structure stable, la configuration Docker optimisée et l'authentification fonctionnelle.
*   **Dépôt Officiel :** `https://github.com/declochezjm-hash/Verdant-v01.git`
*   **Initialisation Git :** Pour lier un nouveau dépôt : `git remote add origin <url>`, puis `git push -u origin main`.
*   **Nouvelles Fonctionnalités :** Tout ajout (gestion des stocks avancée, rapports PDF, etc.) fait désormais l'objet d'une branche dédiée.
*   **Stabilité Docker :** Rappel - Ne pas modifier `src/routeTree.gen.ts` manuellement, laisser le plugin TanStack Router le générer.

## 🧪 8. Qualité & Tests
*   **Tests Unitaires :** Validation des fonctions de calcul de marge et des transformations de données.
*   **Tests E2E :** Validation du workflow complet (Création tâche -> Exécution Agent -> Clôture).

## 📅 9. Prochaines Étapes
*   Implémentation de rapports PDF automatisés pour les clients.
*   Optimisation de la gestion des stocks avec alertes de seuil critique.

---

### 🚦 État actuel : **ADMIN & FIELD READY**

L'écosystème technique est désormais mature. Le flux de données est totalement bouclé : Administration des référentiels (Settings) -> Planification intelligente (Planning) -> Exécution terrain avec preuves médias enrichies (Agent) -> Analyse de rentabilité et gestion des réapprovisionnements (Stocks/Analytics). La sécurité est assurée par le RBAC et des gardes-fous logiques sur les suppressions d'entités critiques.

---
