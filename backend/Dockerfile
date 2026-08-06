FROM node:20-bookworm-slim

WORKDIR /app

# better-sqlite3 & @prisma/adapter-better-sqlite3 kompilieren native
# Bindings beim npm install - ohne diese Build-Tools schlägt der
# Container-Build mit einem gyp-Fehler fehl.
RUN apt-get update && apt-get install -y python3 make g++ openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Prisma-Schema separat kopieren, damit "prisma generate" schon hier
# passieren kann (Docker-Layer-Caching: ändert sich nur dein Code,
# nicht das Schema, wird dieser Schritt nicht neu ausgeführt)
COPY prisma ./prisma
RUN npx prisma generate

COPY . .

# entrypoint.sh macht "prisma db push" bei JEDEM Containerstart -
# wichtig, weil die eigentliche DB-Datei später aus einem Volume kommt
# und beim Image-Build noch gar nicht existiert.
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]