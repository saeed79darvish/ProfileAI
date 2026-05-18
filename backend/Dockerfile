# Multi-stage build for ProfileAI backend.
#
# Notes:
# - Uses Debian-slim (not Alpine) because some deps need glibc (e.g. canvas,
#   puppeteer, pdf-parse). Switching to Alpine breaks native modules.
# - Puppeteer downloads Chromium at install time. In production deployments
#   that don't need browser automation (hybrid mode), set
#   PUPPETEER_SKIP_DOWNLOAD=true before `npm ci` to slim the image further.
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci --omit=dev

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Runtime libs needed by canvas / puppeteer / pdf-parse. Trim if you disable
# those features in production.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 \
      librsvg2-2 fonts-liberation libnss3 libatk1.0-0 libatk-bridge2.0-0 \
      libcups2 libdrm2 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libasound2 ca-certificates curl tini \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=5001

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Drop privileges
RUN useradd -m -u 10001 -s /bin/bash app && chown -R app:app /app
USER app

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:5001/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
