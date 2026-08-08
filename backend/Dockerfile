# syntax=docker/dockerfile:1
# Backend image — Learning Logs API (Node + Express).
#
# Two build targets, one Dockerfile. The builds are fully independent: the dev
# image installs only production dependencies (lean watch server), the test
# image installs everything including jest/supertest. Building either never
# touches the other's image or containers.
#
#   dev  → watch-mode API server (npm ci --omit=dev)
#   test → Jest unit + integration suites (npm ci)
#
# Select a target via the compose files:
#   docker-compose.dev.yaml  → target: dev
#   docker-compose.test.yaml → target: test

FROM node:22-alpine AS base
WORKDIR /app
# Dependency metadata first so source edits don't re-run npm ci. Both targets
# build FROM base, so the package files are reused from the shared cache.
COPY package.json package-lock.json ./

# --- Dev: the hot-reloaded API server. Production deps only — the dev stack
# runs `node --watch` (a Node built-in), which needs no devDependencies. ---
FROM base AS dev
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 3000
CMD ["node", "--watch", "bin/www"]

# --- Test: full install so jest/supertest (devDependencies) are available.
# The command chains the unit suite with the integration suite. ---
FROM base AS test
ENV NODE_ENV=test
RUN npm ci --no-audit --no-fund
COPY . .
CMD ["sh", "-c", "npm test && npm run test:integration"]

# --- Production: lean API server — no watch mode, prod deps only. ---
FROM base AS prod
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 3000
# Runs `node bin/www` (no --watch). NODE_ENV is intentionally left to the
# environment: production deployments behind TLS should set it so auth cookies
# get the Secure flag.
CMD ["node", "bin/www"]
