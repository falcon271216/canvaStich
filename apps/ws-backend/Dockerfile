# Railway: Root Directory = repo root (.), Dockerfile path = apps/ws-backend/Dockerfile

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=ws-backend...

FROM node:20-bookworm-slim AS runner
WORKDIR /app/apps/ws-backend
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app /app

EXPOSE 4003
CMD ["node", "start.cjs"]
