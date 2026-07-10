"use strict";

let app;

try {
  const mod = require("./api/server.js");
  app = mod.default ?? mod;
  if (!app || typeof app !== "function") {
    throw new Error("api/server.js did not export an Express app");
  }
} catch (err) {
  console.error("[boot] failed to load api/server.js:", err);
  const express = require("express");
  app = express();
  app.get("/health", (_req, res) => {
    res.status(500).json({ ok: false, error: "boot failed", detail: String(err) });
  });
  app.all("*", (_req, res) => {
    res.status(500).json({ ok: false, error: "boot failed" });
  });
}

module.exports = app;
