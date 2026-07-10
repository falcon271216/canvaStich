import path from "path";
import { config } from "dotenv";
import type { Express } from "express";
import { createApp } from "./expressApp";

const repoRoot = path.resolve(__dirname, "../..");

if (!process.env.VERCEL) {
  config({ path: path.join(repoRoot, ".env.http-backend") });
  config({ path: path.join(repoRoot, ".env") });
}

let app: Express | null = null;

function getApp(): Express {
  if (!app) {
    app = createApp();
  }
  return app;
}

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  getApp().listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

module.exports = getApp();
