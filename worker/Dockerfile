# Chips bot, Node runtime. Same code as the Cloudflare Worker (worker/src), different host.
#   docker build -t chips-bot worker
#   docker run --rm -p 5000:5000 --env-file worker/.env -v chips-bot-data:/data chips-bot
# Zero npm runtime deps: only src/ and public/ are copied. Node >= 22.5 for node:sqlite.
FROM node:22-alpine

ARG VERSION=unstamped-docker
ARG COMMIT=unknown
ARG BUILT_AT=
ENV VERSION=$VERSION COMMIT=$COMMIT BUILT_AT=$BUILT_AT \
    NODE_ENV=production PORT=5000 HOST=0.0.0.0 DATA_DIR=/data \
    NODE_OPTIONS=--no-warnings

WORKDIR /app
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node package.json ./

RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/adapters/node.js"]
