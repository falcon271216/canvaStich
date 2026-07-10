# Railway: Root Directory = / (repo root)
# dashboard — Next.js dashboard app

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile

# Build args for Next.js public env vars (set in Railway)
ARG NEXT_PUBLIC_HTTP_API
ARG NEXT_PUBLIC_WS_METRICS
ENV NEXT_PUBLIC_HTTP_API=$NEXT_PUBLIC_HTTP_API
ENV NEXT_PUBLIC_WS_METRICS=$NEXT_PUBLIC_WS_METRICS

RUN pnpm turbo build --filter=dashboard...

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build /app /app

WORKDIR /app/apps/dashboard
EXPOSE 3000

CMD ["pnpm", "run", "start"]
