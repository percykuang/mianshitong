# syntax=docker/dockerfile:1.7

# Monorepo Dockerfile for apps/web and apps/admin
#
# Build:
#   docker build --build-arg APP=web -t mianshitong-web .
#   docker build --build-arg APP=admin -t mianshitong-admin .
#   docker build --target migrator -t mianshitong-migrate .
#
# Run (example):
#   docker run --rm -p 3000:3000 mianshitong-web

ARG NODE_VERSION=22.12.0
ARG PNPM_VERSION=10.18.2

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /repo
RUN npm i -g pnpm@${PNPM_VERSION}

FROM base AS deps

# Don't run git hooks installation in container builds.
ENV HUSKY=0

# Copy only manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json vitest.config.ts eslint.config.mjs .prettierrc.cjs .prettierignore cspell.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/llm/package.json packages/llm/package.json
COPY packages/retrieval/package.json packages/retrieval/package.json
COPY packages/agent-skills/package.json packages/agent-skills/package.json
COPY packages/interview-engine/package.json packages/interview-engine/package.json
COPY packages/question-bank/package.json packages/question-bank/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG APP=web
ENV NODE_ENV=production

COPY . .

RUN pnpm db:generate && pnpm -C apps/${APP} build

FROM deps AS migrator
ENV NODE_ENV=production

COPY . .

RUN pnpm db:generate

CMD ["pnpm", "db:migrate:deploy"]

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG APP=web
ENV APP=$APP

# Copy the minimal standalone server output.
COPY --from=builder /repo/apps/${APP}/.next/standalone ./

# Standalone output doesn't include static assets by default; copy them in so the server can serve them.
COPY --from=builder /repo/apps/${APP}/public ./apps/${APP}/public
COPY --from=builder /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static

EXPOSE 3000
CMD ["sh", "-c", "node apps/$APP/server.js"]
