# syntax=docker/dockerfile:1
# Keep both stages on the same pinned runtime so native modules remain compatible.
FROM node:24.21.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

# Production runtime: no compiler toolchain, npm cache, tests, or development dependencies.
FROM node:24.21.0-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 10000
CMD ["node", "src/server.js"]