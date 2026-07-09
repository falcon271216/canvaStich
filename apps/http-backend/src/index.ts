import path from "path";
import { config } from "dotenv";
import { createApp } from "./app";

if (!process.env.VERCEL) {
  config({ path: path.resolve(__dirname, "../../../.env") });
}

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
}

export default app;
