# Build context is the monorepo root — apps/web depends on packages/sdk via an npm
# workspace, so the image needs both, not just apps/web in isolation.
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json ./
COPY packages/sdk/package.json packages/sdk/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/brian/package.json packages/brian/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN npm install --legacy-peer-deps

COPY packages/sdk packages/sdk
COPY packages/brian packages/brian
COPY packages/i18n packages/i18n
COPY apps/web apps/web
ARG NEXT_PUBLIC_NIMLET_URL
ARG NEXT_PUBLIC_BRIAN_AGENT_IDS
ARG NEXT_PUBLIC_BRIAN_PUBLISHER_IDS
ARG NEXT_PUBLIC_BRIAN_SHARING_ENABLED=false
ARG NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED=false
ARG NEXT_PUBLIC_BRIAN_SURFACE_NAMES_ENABLED=true
ARG NEXT_PUBLIC_NIMLET_NAMESPACE=default
ENV NEXT_PUBLIC_NIMLET_URL=$NEXT_PUBLIC_NIMLET_URL
ENV NEXT_PUBLIC_BRIAN_AGENT_IDS=$NEXT_PUBLIC_BRIAN_AGENT_IDS
ENV NEXT_PUBLIC_BRIAN_PUBLISHER_IDS=$NEXT_PUBLIC_BRIAN_PUBLISHER_IDS
ENV NEXT_PUBLIC_BRIAN_SHARING_ENABLED=$NEXT_PUBLIC_BRIAN_SHARING_ENABLED
ENV NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED=$NEXT_PUBLIC_BRIAN_MONTHLY_BILLS_ENABLED
ENV NEXT_PUBLIC_BRIAN_SURFACE_NAMES_ENABLED=$NEXT_PUBLIC_BRIAN_SURFACE_NAMES_ENABLED
ENV NEXT_PUBLIC_NIMLET_NAMESPACE=$NEXT_PUBLIC_NIMLET_NAMESPACE
WORKDIR /repo/apps/web
RUN npm run build:release

FROM node:20-alpine AS runner
# bash is needed for the compose healthcheck's /dev/tcp probe (node:alpine has neither
# wget nor curl by default) — same reasoning as the Nimlet Dockerfile.
RUN apk add --no-cache bash
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# next.config.js has output:"standalone" — this traces only the deps actually reachable at
# runtime instead of shipping the whole monorepo's node_modules into the image.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
