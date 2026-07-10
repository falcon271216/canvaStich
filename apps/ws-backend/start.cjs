const fs = require("fs");
const path = require("path");

const appRoot = __dirname;
const bundlePath = path.join(appRoot, "dist", "server.js");

console.log("[boot] cwd:", process.cwd());
console.log("[boot] appRoot:", appRoot);
console.log("[boot] PORT:", process.env.PORT ?? "(unset)");
console.log("[boot] DATABASE_URL:", process.env.DATABASE_URL ? "set" : "unset");
console.log("[boot] JWT_SECRET:", process.env.JWT_SECRET ? "set" : "unset");

if (!fs.existsSync(bundlePath)) {
  console.error("[boot] missing bundle:", bundlePath);
  try {
    const distDir = path.join(appRoot, "dist");
    console.error("[boot] dist exists:", fs.existsSync(distDir));
    if (fs.existsSync(distDir)) {
      console.error("[boot] dist files:", fs.readdirSync(distDir).join(", "));
    }
  } catch (err) {
    console.error("[boot] dist listing failed:", err);
  }
  process.exit(1);
}

console.log("[boot] loading:", bundlePath);
require(bundlePath);
