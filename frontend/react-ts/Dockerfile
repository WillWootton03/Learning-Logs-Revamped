# syntax=docker/dockerfile:1
# Frontend image — Learning Logs UI (React + Vite).
#
# Dev-focused for now (matches the current dev/test compose stacks): runs the
# Vite dev server with HMR. A production image would add a build stage served
# by nginx — not needed while only dev and test stacks exist.
#
# Vite must bind 0.0.0.0 inside the container or the published port is
# unreachable from the host browser. --host is baked into the default CMD so
# it applies in every environment that doesn't override the command.

FROM node:22-alpine

WORKDIR /app

# Install dependencies first so source changes don't re-trigger npm install.
# npm ci is faster and deterministic (installs the lockfile, no re-resolution);
# the cache mount keeps the package download cache across rebuilds.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# Bundle the app source (node_modules excluded via .dockerignore).
COPY . .

EXPOSE 5173

# Default: Vite dev server on all interfaces (HMR enabled).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
