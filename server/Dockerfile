# syntax=docker/dockerfile:1
# Stage 1: install production deps only. Build tooling never reaches the final image.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: minimal runtime. No npm cache, no tests, no dev deps, runs as the unprivileged `node` user.
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]