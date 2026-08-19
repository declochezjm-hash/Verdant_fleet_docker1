FROM oven/bun:latest

WORKDIR /app

# Installation des dépendances avec Bun (incluant devDependencies pour Vite)
COPY package.json ./
COPY bun.lock ./
RUN bun install

# Copie du code source
COPY . .

EXPOSE 3000

# Démarrage en mode développement avec Vite via Bun
# Utilise le script "dev" du package.json qui lance Vite
CMD ["bun", "run", "dev"]