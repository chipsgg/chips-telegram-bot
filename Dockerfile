# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
RUN corepack enable && yarn install --frozen-lockfile --production=true

FROM node:22-alpine
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json index.js ./
COPY src ./src

USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1
CMD ["node", "index.js"]
