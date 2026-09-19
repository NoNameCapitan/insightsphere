FROM node:24-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p data backups public && npm run build && chown -R node:node /app
USER node
ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/vlk.sqlite
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
# Міграції застосовує локальний рушій: у контейнері без виходу в інтернет
# Prisma CLI марно чекає на перевірку версій.
ENV CHECKPOINT_DISABLE=1
ENV DO_NOT_TRACK=1
CMD ["sh", "-c", "node scripts/migrate.mjs && node .next/standalone/server.js"]
