# ─── Stage 1: Base ────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init openssl

# ─── Stage 2: Dependencies ───────────────────────────────────
FROM base AS deps

COPY package*.json ./

RUN npm ci --omit=dev

COPY prisma ./prisma

RUN npx prisma generate

# ─── Stage 3: Development ────────────────────────────────────
FROM base AS development

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["dumb-init", "node", "--watch", "src/server.js"]

# ─── Stage 4: Production ─────────────────────────────────────
FROM base AS production

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules

COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma

COPY . .

EXPOSE 5000

CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node src/server.js"]