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
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Bundle the app source (node_modules excluded via .dockerignore).
COPY . .

EXPOSE 5173

# Default: Vite dev server on all interfaces (HMR enabled).
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
