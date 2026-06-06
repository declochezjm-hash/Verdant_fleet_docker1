FROM oven/bun:1.1-alpine

WORKDIR /app

# Installation des dépendances avec le cache de Bun
COPY package.json ./
COPY bun.lockb* ./
RUN bun install

# Copie du code source
COPY . .

EXPOSE 3000

# Démarrage en mode host pour permettre l'accès depuis l'extérieur du conteneur
CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "3000"]