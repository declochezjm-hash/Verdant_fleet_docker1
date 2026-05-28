FROM oven/bun:1.1-alpine

WORKDIR /app

# Installation des dépendances avec Bun
COPY package.json bun.lockb* ./
RUN bun install

COPY . .

EXPOSE 3000
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]