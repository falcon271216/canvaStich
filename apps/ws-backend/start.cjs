const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, "dist", "server.js"),
  path.join(process.cwd(), "apps", "ws-backend", "dist", "server.js"),
  path.join(process.cwd(), "dist", "server.js"),
];

console.log("[boot] cwd:", process.cwd());
console.log("[boot] __dirname:", __dirname);
console.log("[boot] PORT:", process.env.PORT ?? "(unset)");
console.log("[boot] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "unset");
console.log("[boot] JWT_SECRET:", process.env.JWT_SECRET ? "set" : "unset");

const bundlePath = candidates.find((p) => fs.existsSync(p));

if (!bundlePath) {
  console.error("[boot] server.js not found. Tried:");
  candidates.forEach((p) => console.error("  -", p));
  process.exit(1);
}

console.log("[boot] loading:", bundlePath);
require(bundlePath);
