# 📝 RÉSUMÉ DU PROJET : Verdant Fleet

**Objectif :** Application de gestion d'interventions pour entreprises d'espaces verts, incluant la planification, le suivi terrain, la gestion des stocks et la comptabilité analytique.

## 🏗️ 1. Architecture & Infrastructure

*   **Runtime :** Migration vers **Bun** (`oven/bun:1.1-alpine`) pour la rapidité d'exécution et la gestion des dépendances.
*   **Docker :** Environnement stabilisé.
    *   **Ports :** L'application tourne sur le port `3000` (exposé via `--port 3000 --host 0.0.0.0` dans le Dockerfile).
    *   **Volume :** Isolation du dossier `node_modules` pour éviter les conflits entre Windows (Hôte) et Linux (Conteneur).
    *   **Hot-Reload :** Activation du *polling* (`CHOKIDAR_USEPOLLING=true`) dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\docker-compose.yml` pour garantir la détection des changements de fichiers sur Windows.
    *   **Layout & Navigation :** Implémentation d'une **Sidebar responsive** (`sidebar.tsx`) avec gestion du menu mobile et **badges de notification en temps réel** pour le matériel nécessitant une maintenance.
*   **Client Supabase :** Configuration durcie dans `src/integrations/supabase/client.ts` avec détection des variables manquantes. Supporte les clés commençant par `eyJ` et gère la persistance de session.

## 🗄️ 2. Base de Données & Backend (Supabase)

*   **Schéma SQL (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_schema.sql`) :**
    *   Tables : `profiles`, `user_roles`, `tasks`, `products`, `equipment`, `anomalies`.
    *   Système **RBAC** : Rôles `agent`, `coordinator`, `admin`. Trigger `handle_new_user` pour la création automatique de profils à l'inscription.
    *   **Statut `annule` :** Ajouté à l'énumération `task_status` pour une meilleure traçabilité.
    *   **Row Level Security (RLS) :** Politiques activées pour isoler les données des agents (voient leurs tâches assignées) tout en permettant aux coordinateurs une visibilité globale.
    *   **Stockage Supabase :** Bucket `task-media` configuré avec RLS pour la gestion des photos de chantier (avant/après) et signatures client.
*   **Logique Métier (RPC) :**
    *   Implémentation de la fonction `finish_task` (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase\migrations\20260508090000_add_finish_task_rpc.sql`).
    *   Cette fonction atomique gère la clôture, l'enregistrement des notes/signatures, le calcul du coût de main-d'œuvre et la décrémentation des stocks. Elle inclut désormais la prise en compte du **numéro de lot** et de la **dose par m²** pour les produits.
    *   **RPC `seed_demo_data` :** Fonction SQL permettant de générer instantanément des données de test liées à l'utilisateur connecté (rôles, profils, tâches, matériel).

## 🎨 3. Fonctionnalités Frontend (React & TanStack)

*   **Gestion des Chantiers (Coordinator) :**
    *   Interface dans `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\coordinator-view.tsx`.
    *   **Refonte complète de l'UI :** Organisation par onglets (**Suivi chantiers** pour l'actif et **Journal d'activité** pour l'historique).
    *   **CRUD complet :** Formulaire enrichi avec gestion du **budget prévisionnel**, calcul de progression temporelle et assignation multiple de matériel.
    *   Filtrage par équipe, recherche textuelle et export **CSV** pour le reporting (basé sur la liste filtrée).
    *   Gestion des suppressions et annulations d'interventions avec dialogues de confirmation.
    *   Intégration de la `TaskDetailsSheet` pour consulter les preuves terrain (photos, produits) sans quitter la liste.
*   **Dashboard Coordinateur :**
    *   Migration complète vers Supabase (`coordinator-dashboard.tsx`).
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
*   **Planning & Cartographie :**
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\planning-supabase-view.tsx` : Drag & Drop fonctionnel pour déplacer les chantiers.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\carte-supabase-view.tsx` : Intégration **Mapbox** avec gestion des tokens locaux et filtrage des marqueurs.
*   **Comptabilité & Stocks :**
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\settings-view.tsx` : Gestion des taux horaires des agents et bouton **"Générer les données démo"**.
    *   `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\admin-analytics.tsx` et `d:\CODE\verdant-fleet\verdant-fleet-docker1\src\components\views\coordinator-dashboard.tsx` : Graphiques de rentabilité corrigés avec `minWidth={0}` pour Recharts afin d'éviter les crashs de rendu dans les conteneurs flexibles.

## 🛣️ 4. Routage & Structure

*   **TanStack Router :** Arbre de routes synchronisé (`routeTree.gen.ts`) incluant désormais `/coordinator`, `/analytics`, `/stocks`, and `/settings`.
*   **Layout Racine :** Gestion centralisée des erreurs et de l'authentification dans `__root.tsx`.

## 🧪 4. État des Données

*   **Mock Data :** Un script SQL de génération de données de test (`d:\CODE\verdant-fleet\verdant-fleet-docker1\supabase_mock_data.sql`) est prêt pour peupler l'inventaire, le matériel et les chantiers fictifs, permettant de tester toutes les fonctionnalités.

---

### 🚦 État actuel : **FULL STACK STABILIZED**

L'écosystème technique est complet. Le flux de données est bouclé : Planification (Coordinateur) -> Exécution & Photos (Agent) -> Analyse & Stocks (Admin). L'infrastructure Docker/Supabase est prête pour le déploiement.

---
