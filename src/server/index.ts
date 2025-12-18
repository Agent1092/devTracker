import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import initSqlJs, { Database } from "sql.js";

type Row = Record<string, any>;

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadDbFromDisk(dbPath: string): Uint8Array | null {
  try {
    if (!fs.existsSync(dbPath)) return null;
    const buf = fs.readFileSync(dbPath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

function saveDbToDisk(db: Database, dbPath: string) {
  ensureDirForFile(dbPath);
  const data = db.export(); // Uint8Array
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function rowList(db: Database, sql: string, params: any[] = []): Row[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const out: Row[] = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

function run(db: Database, sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.run(params);
  } finally {
    stmt.free();
  }
}

export async function startServer(dbPath: string, port: number) {
  ensureDirForFile(dbPath);

  // Locate wasm file inside node_modules at runtime
  const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });

  const disk = loadDbFromDisk(dbPath);
  const db = disk ? new SQL.Database(disk) : new SQL.Database();

  // Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      installation_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      project_root TEXT,
      full_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snap_install_time
      ON snapshots(installation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snap_install_file_time
      ON snapshots(installation_id, file_path, created_at DESC);
  `);

  // Debounced persistence (so we don't write disk on every keystroke)
  let saveTimer: NodeJS.Timeout | null = null;
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        saveDbToDisk(db, dbPath);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("DevTracker: DB save failed:", e);
      }
    }, 1000);
  };

  const app = express();
  app.use(bodyParser.json({ limit: "5mb" }));

  app.get("/system/health", (_req, res) => res.json({ ok: true }));

  app.post("/events/file-change", (req, res) => {
    const { installation_id, file_path, project_root, content, timestamp } = req.body || {};
    if (!installation_id || !file_path || typeof content !== "string" || !timestamp) {
      return res.status(422).json({ error: "invalid payload" });
    }

    run(
      db,
      `INSERT INTO snapshots (installation_id, file_path, project_root, full_text, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [installation_id, file_path, project_root ?? null, content, timestamp]
    );

    scheduleSave();
    res.json({ ok: true });
  });

  app.get("/snapshots/latest", (req, res) => {
    const installationId = String(req.query.installation_id || "");
    const limit = Math.min(Number(req.query.limit || 200), 500);

    if (!installationId) return res.status(422).json({ error: "installation_id required" });

    const rows = rowList(
      db,
      `SELECT id, file_path, created_at
       FROM snapshots
       WHERE installation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [installationId, limit]
    );

    res.json(rows);
  });

  app.get("/snapshots/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(422).json({ error: "invalid id" });

    const rows = rowList(
      db,
      `SELECT id, file_path, created_at, full_text
       FROM snapshots
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  app.post("/summary/local", (req, res) => {
    const { installation_id, date } = req.body || {};
    if (!installation_id || !date) return res.status(422).json({ error: "invalid payload" });

    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);

    const files = rowList(
      db,
      `SELECT file_path as path, COUNT(*) as snapshots
       FROM snapshots
       WHERE installation_id = ?
         AND created_at >= ?
         AND created_at < ?
       GROUP BY file_path
       ORDER BY snapshots DESC`,
      [installation_id, day.toISOString(), next.toISOString()]
    );

    res.json({
      date: day.toISOString().slice(0, 10),
      total_files: files.length,
      files,
    });
  });

  const server = app.listen(port, "127.0.0.1", () => {
    // eslint-disable-next-line no-console
    console.log(`DEVTRACKER_SERVER_READY ${port}`);
  });

  // flush DB on exit
  const shutdown = () => {
    try {
      if (saveTimer) clearTimeout(saveTimer);
      saveDbToDisk(db, dbPath);
    } catch {}
    try {
      server.close();
    } catch {}
    try {
      db.close();
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { app, server };
}
