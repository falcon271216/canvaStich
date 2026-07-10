# Railway: Root Directory = / (repo root)
# http-backend — Express API bundled with esbuild, served as Node.js

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec prisma generate --schema=packages/db/prisma/schema.prisma
RUN pnpm turbo build --filter=http-backend...

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=build /app /app

WORKDIR /app/apps/http-backend
EXPOSE 4000

CMD ["node", "-e", "const h=require('http');const app=require('./api/app.bundle.cjs');const port=process.env.PORT||4000;h.createServer(app).listen(port,'0.0.0.0',()=>console.log('http-backend listening on port',port))"]
