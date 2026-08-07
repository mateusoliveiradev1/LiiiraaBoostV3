# syntax=docker/dockerfile:1.7

FROM node:24.18.0-bookworm-slim AS workspace

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts-ts/package.json packages/contracts-ts/package.json
COPY packages/control-plane-adapters/package.json packages/control-plane-adapters/package.json
COPY packages/control-plane-application/package.json packages/control-plane-application/package.json
COPY packages/control-plane-domain/package.json packages/control-plane-domain/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM workspace AS verified

COPY apps/api apps/api
COPY packages/contracts-ts packages/contracts-ts
COPY packages/control-plane-adapters packages/control-plane-adapters
COPY packages/control-plane-application packages/control-plane-application
COPY packages/control-plane-domain packages/control-plane-domain
COPY contracts contracts
COPY .github .github
COPY .dockerignore .dockerignore

RUN pnpm --filter @liiiraa/api test -- --run staging-config
RUN pnpm --filter @liiiraa/api test -- --run container-contract

FROM node:24.18.0-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="Liiiraa Boost staging API"
LABEL org.opencontainers.image.description="Invitation-only synthetic Fastify control plane"

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /workspace
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=verified --chown=node:node /workspace/node_modules node_modules
COPY --from=verified --chown=node:node /workspace/apps/api apps/api
COPY --from=verified --chown=node:node /workspace/packages packages

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/api/src/staging/main.mjs"]
