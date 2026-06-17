# ─── Stage 1: Base ────────────────────────────────────────────
FROM node:22-slim AS base

WORKDIR /app

RUN apt-get update && apt-get install -y \
    dumb-init \
    openssl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    && rm -rf /var/lib/apt/lists/*

# ─── Stage 2: Dependencies ───────────────────────────────────
FROM base AS deps

COPY package*.json ./

RUN npm ci --omit=dev

RUN npx puppeteer browsers install chrome

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

COPY --from=deps /root/.cache/puppeteer /root/.cache/puppeteer

COPY . .

EXPOSE 5000

CMD ["dumb-init", "sh", "-c", "npx prisma migrate deploy && node src/server.js"]