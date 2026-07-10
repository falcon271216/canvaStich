# Railway: Root Directory = repo root (.), Dockerfile path = apps/ws-backend/Dockerfile
# Turbo filter builds only ws-backend — Next.js apps are not compiled.

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

COPY --from=build /app/apps/ws-backend/dist ./dist
COPY --from=build /app/apps/ws-backend/package.json ./package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/db/prisma /app/packages/db/prisma

EXPOSE 4003
CMD ["node", "dist/server.js"]
