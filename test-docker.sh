#!/bin/bash

# Script de test pour vérifier que Docker fonctionne correctement

echo "=========================================="
echo "Test de démarrage Docker pour Verdant Fleet"
echo "=========================================="
echo ""

# Vérifier que Docker est installé
echo "[1/5] Vérification de Docker..."
if ! docker --version > /dev/null 2>&1; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi
echo "✅ Docker est installé"
echo ""

# Vérifier que docker-compose est installé
echo "[2/5] Vérification de docker-compose..."
if ! docker-compose --version > /dev/null 2>&1; then
    echo "❌ docker-compose n'est pas installé"
    exit 1
fi
echo "✅ docker-compose est installé"
echo ""

# Construire l'image Docker
echo "[3/5] Construction de l'image Docker..."
docker-compose build
echo ""

# Démarrer le conteneur
echo "[4/5] Démarrage du conteneur..."
docker-compose up -d
echo ""

# Attendre que le conteneur soit prêt
echo "[5/5] Attente du démarrage de l'application..."
sleep 10

# Vérifier si l'application répond
echo ""
echo "Vérification de l'application..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ L'application est accessible sur http://localhost:3000"
    echo ""
    echo "=========================================="
    echo "Test réussi !"
    echo "=========================================="
    echo ""
    echo "Vous pouvez accéder à l'application sur: http://localhost:3000"
    echo "Pour voir les logs: docker-compose logs -f"
    echo "Pour arrêter: docker-compose down"
else
    echo "❌ L'application ne répond pas sur http://localhost:3000"
    echo ""
    echo "Affichage des logs du conteneur..."
    docker-compose logs
    exit 1
fi
