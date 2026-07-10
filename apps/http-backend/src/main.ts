import path from "path";
import { config } from "dotenv";
import { createApp } from "./app";

const repoRoot = path.resolve(__dirname, "../..");

if (!process.env.VERCEL) {
  config({ path: path.join(repoRoot, ".env.http-backend") });
  config({ path: path.join(repoRoot, ".env") });
}

const app = createApp();

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

module.exports = app;
