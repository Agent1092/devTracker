"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/server/cli.ts
const index_1 = require("./index");
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
(0, index_1.startServer)(dbPath, port);
//# sourceMappingURL=cli.js.map