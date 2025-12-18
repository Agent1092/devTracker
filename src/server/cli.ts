// src/server/cli.ts
import { startServer } from "./index";

const dbPath = process.env.DEVTRACKER_DB_PATH;
const port = Number(process.env.DEVTRACKER_PORT || "0");

if (!dbPath) {
  console.error("Missing DEVTRACKER_DB_PATH");
  process.exit(1);
}

if (!Number.isFinite(port) || port <= 0) {
  console.error("Missing/invalid DEVTRACKER_PORT");
  process.exit(1);
}

startServer(dbPath, port);
