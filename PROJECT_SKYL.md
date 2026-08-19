# 📝 RÉSUMÉ DU PROJET : Verdant Fleet

**Objectif :** Application de gestion d'interventions pour entreprises d'espaces verts, incluant la planification, le suivi terrain, la gestion des stocks et la comptabilité analytique.

## 🏗️ 1. Architecture & Sécurité (V02)

*   **Runtime :** Utilisation de **Bun 1.1** pour la rapidité d'exécution.
*   **Docker :** Environnement stabilisé.
    *   **Image :** `oven/bun:1.1-alpine` pour un conteneur léger et performant.
    *   **Ports :** Port `3000` exposé.
    *   **Volume :** Isolation du dossier `node_modules` pour éviter les conflits entre Windows (Hôte) et Linux (Conteneur).
    *   **Hot-Reload :** Activation du *polling* (`CHOKIDAR_USEPOLLING=true`) dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\docker-compose.yml` pour garantir la détection des changements de fichiers sur Windows.
    *   **Variables d'Environnement Requises :**
        *   `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` : Connexion base de données.
        *   `VITE_MAPBOX_TOKEN` : Affichage de la carte et calcul d'itinéraires.
        *   `VITE_WEATHER_API_KEY` : Prévisions météo (OpenWeatherMap).
    *   **Layout & Navigation :** Implémentation d'une **Sidebar responsive** (`sidebar.tsx`) avec gestion du menu mobile et **badges de notification en temps réel** pour le matériel nécessitant une maintenance.
    *   **Sécurité des Secrets :** Migration vers le dépôt **V02** avec activation de la protection contre l'envoi de secrets (Secret Scanning). Exclusion stricte du fichier `.env` via `.gitignore`.
    *   **Authentification & RBAC :** Flux sécurisé. Système de rôles strict : les agents sont désormais restreints aux onglets essentiels (**Planning/Carte**) et ne voient que leurs propres données grâce au filtrage `user_id`.
    *   **Authentification :** Flux Email/Mot de passe sécurisé. Gestion du **blocage des comptes** et procédure de **récupération de mot de passe** via `/reset-password`.
    *   **Utilitaires :** Centralisation de la compression d'images (`image-utils.ts`) et de la gestion chromatique des équipes (`team-utils.ts`).
    *   **Sécurité des types :** Intégration de **Zod** pour la validation des réponses API externes (OpenWeatherMap).
*   **Client Supabase :** Configuration durcie dans `src/integrations/supabase/client.ts` avec détection des variables manquantes. Supporte les clés commençant par `eyJ` et gère la persistance de session.

## 🗄️ 2. Base de Données & Backend (Supabase)

*   **Schéma SQL (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_schema.sql`) :**
    *   Tables : `profiles`, `user_roles`, `tasks`, `products`, `equipment`, `anomalies`, `teams`, `suppliers`, `clients`, `purchase_orders`, `invoices`.
    *   Système **RBAC** : Rôles `agent`, `coordinator`, `admin`.
    *   **Gestion des Profils :** Support des "Profils Fantômes". Suppression de la contrainte FK stricte sur `profiles.id` pour permettre la création manuelle. Colonne `email` unique servant de pivot.
    *   **Liaison Automatique :** Trigger `handle_new_user` amélioré pour lier un profil manuel existant à un compte Auth lors de l'inscription.
    *   **Suivi Activité :** Colonnes `last_login_at` (synchronisée par trigger) et `is_blocked`.
    *   **Statut `annule` :** Ajouté à l'énumération `task_status` pour une meilleure traçabilité.
    *   **Priorité des tâches :** Ajout de la colonne `priority` (`normale`, `haute`, `urgente`) à la table `tasks`.
    *   **Gestion des équipes :** Table `teams` avec couleurs personnalisées et support du flag `is_archived` pour préserver l'historique sans encombrer le planning.
    *   **Finance d'Équipe :** Colonnes de frais généraux (`overhead_labor_pct`, `overhead_equip_pct`, etc.), marge et taxes directement rattachées à la configuration de l'équipe.
    *   **Parc Matériel :** Support complet des identifiants internes. Fiches techniques détaillées (S/N, immat, motorisation). Les badges de statut sont interactifs pour une maintenance réactive.
    *   **Vues SQL (STABILISÉ) :** Vue `v_equipment_alerts` opérationnelle. Le parc est fixé à **27/28 machines actives**. Cohérence parfaite entre le badge de la sidebar (5) et la liste filtrable suite à la levée des restrictions RLS sur `equipment`.
    *   **Gestion des Tiers :** Tables `suppliers` et `clients` incluant les coordonnées de contact (email, tel).
    *   **Sécurité des Données :** Filtrage `task_assignments!inner(user_id)` garantissant la confidentialité des chantiers entre agents.
    *   **Stockage Supabase :** Bucket `task-media` configuré avec RLS pour la gestion des photos de chantier (avant/après) et signatures client.
*   **Logique Métier (RPC) :**
    *   Implémentation de la fonction `finish_task` (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase\migrations\20260508090000_add_finish_task_rpc.sql`).
    *   Cette fonction atomique gère la clôture, l'enregistrement des notes/signatures, le calcul du coût de main-d'œuvre, la décrémentation des stocks et la **mise à jour automatique des compteurs d'heures du matériel** (incluant l'alerte de maintenance).
    *   **RPC `seed_demo_data` :** Fonction SQL permettant de générer instantanément des données de test liées à l'utilisateur connecté (rôles, profils, tâches, matériel).
    *   **Types TypeScript :** Synchronisation automatisée des types et enums via la CLI Supabase pour une sécurité accrue au build.

## 🎨 3. Fonctionnalités Frontend (React & TanStack)

*   **Gestion des Chantiers (Coordinator) :**
    *   Interface dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\coordinator-view.tsx`.
    *   **Unification CRUD :** `TaskCreateDialog` avec sélecteur GPS, géocodage inverse, recherche d'adresse et **estimation financière en temps réel** (Déboursé Sec Total).
    *   **Gestion visuelle :** Badges dynamiques, filtrage par priorité et recherche par machine/ID. Animations de transitions fluides.
    *   **Dashboard Interactif :** Les cartes de résumé (Total, En cours, À venir) servent désormais de **filtres rapides** pour le tableau des tâches.
    *   **Expérience Utilisateur (UX) :** Intégration d'animations de **fondus enchaînés (fade-in) avec effet de décalage (stagger)** lors du filtrage ou du changement d'équipe pour une interface plus fluide.
    *   Filtrage dynamique par équipe (récupéré depuis la DB), recherche textuelle et export **CSV** pour le reporting (basé sur la liste filtrée).
    *   Gestion des suppressions et annulations d'interventions avec dialogues de confirmation.
    *   **Journal des Anomalies :** Vue dédiée (`/anomalies`) avec **notes techniques de réparation** et galerie photo comparative. La résolution remet automatiquement le matériel en service.
    *   Intégration de la `TaskDetailsSheet` avec Timeline, preuves photos, signature client et bouton d'**impression des rapports**.
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
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\planning-supabase-view.tsx` : 
        *   **Drag & Drop** fonctionnel pour réaffectation rapide.
        *   **Aide au choix d'équipe :** Affichage du coût horaire de l'équipe (PV TTC) directement dans les sélecteurs de planification.
    *   **Flux guidé :** Message d'alerte et redirection si aucune équipe n'est configurée.
    *   **Smart Scheduling (OPÉRATIONNEL) :** Intégration de l'API OpenWeatherMap avec affichage d'icônes de prévision sur le **Planning**, la **Carte** et le **Détail des chantiers**. Système d'alerte visuelle (animation bounce et icône triangle) en cas de conflit météo.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\carte-supabase-view.tsx` : Intégration **Mapbox** optimisée. Persistance du token via `localStorage`. Initialisation de la carte en parallèle du chargement des données. **Géolocalisation en temps réel** ajoutée pour recentrer la carte sur la position de l'utilisateur. Affichage de la distance et du **temps de trajet estimé** vers le chantier le plus proche via l'API Mapbox Directions, avec un bouton "Itinéraire" pour lancer la navigation (Google Maps).
*   **Comptabilité & Stocks :**
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\settings-view.tsx` : 
        *   **Gestion Équipes :** Interface à deux colonnes avec barres de recherche et filtres de disponibilité. Calcul automatique du **PV Final TTC** basé sur le déboursé sec et les frais de gestion.
        *   **Parc Matériel :** CRUD complet des machines avec seuils de maintenance et coûts horaires.
        *   **Onboarding RH :** Création manuelle de collaborateurs, système d'invitation avec **génération de code temporaire** et envoi d'email via client éphémère (sans déconnexion admin).
        *   **Sécurité :** Menu d'action pour bloquer les accès ou forcer une réinitialisation de mot de passe.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\admin-analytics.tsx` : Tableaux de bord financiers avec **filtrage dynamique par équipe** et calcul automatique de la marge brute (Budget - [MO + Matériel + Produits]).
        *   **Analytique Avancée :** Rapports basés sur le **Prix de Revient** (Coûts directs + Frais généraux) pour une vision réelle de la **Marge Nette**.
        *   **Export Compta :** Export CSV complet incluant les coûts chargés par catégorie.

## ️ 4. Gestion des Pannes & Maintenance Matériel

*   **Cycle de vie des Anomalies :**
    *   **Signalement (Agent) :** Interface simplifiée sur mobile permettant de déclarer une panne instantanément (bouton d'urgence). Le système lie automatiquement le chantier, l'équipement et l'agent rapporteur.
    *   **Résolution (Coordinateur) :** Journal centralisé (`/anomalies`) pour le suivi des réparations. La résolution d'une anomalie permet de basculer le matériel du statut "En panne" à "OK".
*   **Maintenance Préventive :**
    *   **Compteurs d'heures :** Incrémentation automatique via le RPC `finish_task` à la clôture de chaque intervention, basée sur la durée réelle du chantier.
    *   **Journal des Anomalies :** Support des notes de réparation et des photos "Après" pour la remise en service du matériel.
    *   **Analytique Matériel :** Chaque engin dispose désormais d'un **historique graphique d'utilisation sur 30 jours** (Recharts) et d'une fiche technique détaillée (S/N, Immatriculation, Motorisation).
    *   **Support Utilisateur :** Centre d'aide interactif et recherchable intégré à la sidebar, s'adaptant dynamiquement au rôle de l'utilisateur.
*   **Impact Opérationnel :** Le matériel déclaré "En panne" est visuellement marqué dans les outils d'affectation pour éviter la planification de ressources indisponibles.
*   **Analytique Matériel :** Implémentation d'une barre de recherche, d'un filtrage par type et d'un bouton d'urgence. Ajout d'un compteur d'heures restantes et d'un **historique graphique d'utilisation sur 30 jours** via Recharts pour chaque engin.

## 🛣️ 5. Routage & Structure

*   **TanStack Router :** Arbre de routes synchronisé (`routeTree.gen.ts`) incluant désormais `/coordinator`, `/analytics`, `/stocks`, and `/settings`.
*   **Layout Racine :** Gestion centralisée des erreurs et de l'authentification dans `__root.tsx`.
## 🧪 6. État des Données

*   **Mock Data :** Un script SQL de génération de données de test (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_mock_data.sql`) est prêt pour peupler l'inventaire, le matériel et les chantiers fictifs, permettant de tester toutes les fonctionnalités.

## 🚀 7. Workflow de Développement

*   **Branche Principale (`main`) :** Contient la structure stable, la configuration Docker optimisée et l'authentification fonctionnelle.
*   **Dépôt Officiel :** `https://github.com/declochezjm-hash/verdant-V02.git` (Migration effectuée).
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
