# Guide de dépannage Docker pour Verdant Fleet

## Problèmes courants et solutions

### 🚨 Problème 1 : Page blanche au chargement

**Cause possible :**
- Supabase n'est pas accessible ou les variables d'environnement ne sont pas chargées
- Le chargement de la session reste bloqué

**Solutions :**
1. Vérifiez que les variables d'environnement sont correctement définies dans `.env`
2. Vérifiez que Supabase est accessible depuis votre réseau
3. Les timeouts ont été ajoutés (10 secondes) pour éviter les blocages infinis

**Vérification :**
```bash
docker-compose logs verdant-app
```

Recherchez les messages :
- `[AuthContext] Timeout de getSession atteint`
- `[Supabase Client] Utilisation de valeurs par défaut`

### 🚨 Problème 2 : Erreur "quirks mode"

**Cause :** Le navigateur ne détecte pas de DOCTYPE HTML.

**Solution appliquée :**
- Le plugin `force-doctype` a été ajouté dans `vite.config.ts`
- Le fichier `index.html` contient bien `<!DOCTYPE html>`
- Le serveur SSR (`server.ts`) force aussi le DOCTYPE

### 🚨 Problème 3 : Docker ne démarre pas

**Vérifications :**
1. Docker est-il installé ?
   ```bash
   docker --version
   ```

2. Le conteneur existe-t-il ?
   ```bash
   docker ps -a
   ```

3. Les logs du conteneur :
   ```bash
   docker-compose logs
   ```

### 🚨 Problème 4 : Variables d'environnement non chargées

**Solution :**
Les variables sont définies directement dans `docker-compose.yml` pour éviter les problèmes de chargement.

### 🚨 Problème 5 : Erreur de build Bun

**Solution :**
- Utilisez `bun install` (sans `--production`) pour inclure les devDependencies
- Vérifiez que `bun.lock` existe

## Commandes utiles

### Démarrer l'application
```bash
docker-compose up -d
```

### Arrêter l'application
```bash
docker-compose down
```

### Voir les logs en temps réel
```bash
docker-compose logs -f
```

### Rebuilder l'image
```bash
docker-compose build --no-cache
```

### Accéder au shell du conteneur
```bash
docker exec -it verdant-fleet-v2 sh
```

## Configuration requise

### Variables d'environnement
Le fichier `.env` doit contenir :
```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=votre-cle-anonyme
VITE_MAPBOX_TOKEN=votre-token-mapbox
VITE_WEATHER_API_KEY=votre-cle-meteo
```

### Ports
- L'application écoute sur le port **3000**
- Assurez-vous que ce port est disponible

## Corrections appliquées

1. ✅ Timeout ajouté dans `index.tsx` et `auth-context.tsx` (10 secondes)
2. ✅ Lazy loading corrigé dans `__root.tsx`
3. ✅ Dockerfile utilise Bun avec toutes les dépendances
4. ✅ docker-compose.yml configure les variables d'environnement
5. ✅ Plugin force-doctype ajouté dans vite.config.ts
6. ✅ Gestion d'erreur améliorée dans Supabase client

## Si rien ne fonctionne

1. Supprimez tous les conteneurs et images :
   ```bash
   docker system prune -a
   ```

2. Reclonez le projet et relancez :
   ```bash
   git clone <url-du-depot>
   cd verdant-fleet-docker1
   docker-compose up -d
   ```

3. Vérifiez la connexion internet depuis le conteneur :
   ```bash
   docker exec -it verdant-fleet-v2 ping google.com
   ```

4. Testez la connexion Supabase depuis le conteneur :
   ```bash
   docker exec -it verdant-fleet-v2 curl -v https://xydvfyojvttasipfxoyk.supabase.co
   ```
