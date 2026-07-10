"use strict";

let expressApp;

function loadApp() {
  if (!expressApp) {
    const mod = require("../dist/vercel-app.cjs");
    expressApp = mod.default ?? mod;
    if (!expressApp || typeof expressApp !== "function") {
      throw new Error("dist/vercel-app.cjs did not export an Express app");
    }
  }
  return expressApp;
}

module.exports = (req, res) => {
  try {
    return loadApp()(req, res);
  } catch (err) {
    console.error("[api] boot failed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          error: "handler failed",
          detail: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
};
