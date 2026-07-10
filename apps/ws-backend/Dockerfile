# Railway: Root Directory = / (repo root). See ../../railway.toml

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=ws-backend...

FROM node:20-bookworm-slim AS runner
WORKDIR /app/apps/ws-backend
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app /app

CMD ["node", "start.cjs"]
