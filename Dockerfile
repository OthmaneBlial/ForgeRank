FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS operations
ENV NODE_ENV=production
ENV FORGERANK_DATA_DIR=/var/lib/forgerank
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git tini \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/lib/forgerank/git-cache /var/lib/forgerank/http-cache \
  && chown -R node:node /var/lib/forgerank
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node data/seeds ./data/seeds
USER node
ENTRYPOINT ["tini", "--"]
CMD ["pnpm", "worker"]

FROM node:22-bookworm-slim AS web
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV FORGERANK_DATA_DIR=/var/lib/forgerank
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/lib/forgerank/git-cache \
  && chown -R node:node /var/lib/forgerank
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
