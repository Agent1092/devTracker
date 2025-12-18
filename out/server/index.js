"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sql_js_1 = __importDefault(require("sql.js"));
function ensureDirForFile(filePath) {
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
}
function loadDbFromDisk(dbPath) {
    try {
        if (!fs_1.default.existsSync(dbPath))
            return null;
        const buf = fs_1.default.readFileSync(dbPath);
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    catch {
        return null;
    }
}
function saveDbToDisk(db, dbPath) {
    ensureDirForFile(dbPath);
    const data = db.export(); // Uint8Array
    fs_1.default.writeFileSync(dbPath, Buffer.from(data));
}
function rowList(db, sql, params = []) {
    const stmt = db.prepare(sql);
    try {
        stmt.bind(params);
        const out = [];
        while (stmt.step())
            out.push(stmt.getAsObject());
        return out;
    }
    finally {
        stmt.free();
    }
}
function run(db, sql, params = []) {
    const stmt = db.prepare(sql);
    try {
        stmt.run(params);
    }
    finally {
        stmt.free();
    }
}
async function startServer(dbPath, port) {
    ensureDirForFile(dbPath);
    // Locate wasm file inside node_modules at runtime
    const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
    const SQL = await (0, sql_js_1.default)({
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
    let saveTimer = null;
    const scheduleSave = () => {
        if (saveTimer)
            clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            try {
                saveDbToDisk(db, dbPath);
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.error("DevTracker: DB save failed:", e);
            }
        }, 1000);
    };
    const app = (0, express_1.default)();
    app.use(body_parser_1.default.json({ limit: "5mb" }));
    app.get("/system/health", (_req, res) => res.json({ ok: true }));
    app.post("/events/file-change", (req, res) => {
        const { installation_id, file_path, project_root, content, timestamp } = req.body || {};
        if (!installation_id || !file_path || typeof content !== "string" || !timestamp) {
            return res.status(422).json({ error: "invalid payload" });
        }
        run(db, `INSERT INTO snapshots (installation_id, file_path, project_root, full_text, created_at)
       VALUES (?, ?, ?, ?, ?)`, [installation_id, file_path, project_root ?? null, content, timestamp]);
        scheduleSave();
        res.json({ ok: true });
    });
    app.get("/snapshots/latest", (req, res) => {
        const installationId = String(req.query.installation_id || "");
        const limit = Math.min(Number(req.query.limit || 200), 500);
        if (!installationId)
            return res.status(422).json({ error: "installation_id required" });
        const rows = rowList(db, `SELECT id, file_path, created_at
       FROM snapshots
       WHERE installation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`, [installationId, limit]);
        res.json(rows);
    });
    app.get("/snapshots/:id", (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(422).json({ error: "invalid id" });
        const rows = rowList(db, `SELECT id, file_path, created_at, full_text
       FROM snapshots
       WHERE id = ?
       LIMIT 1`, [id]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ error: "not found" });
        res.json(row);
    });
    app.post("/summary/local", (req, res) => {
        const { installation_id, date } = req.body || {};
        if (!installation_id || !date)
            return res.status(422).json({ error: "invalid payload" });
        const day = new Date(date);
        day.setHours(0, 0, 0, 0);
        const next = new Date(day);
        next.setDate(next.getDate() + 1);
        const files = rowList(db, `SELECT file_path as path, COUNT(*) as snapshots
       FROM snapshots
       WHERE installation_id = ?
         AND created_at >= ?
         AND created_at < ?
       GROUP BY file_path
       ORDER BY snapshots DESC`, [installation_id, day.toISOString(), next.toISOString()]);
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
            if (saveTimer)
                clearTimeout(saveTimer);
            saveDbToDisk(db, dbPath);
        }
        catch { }
        try {
            server.close();
        }
        catch { }
        try {
            db.close();
        }
        catch { }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return { app, server };
}
//# sourceMappingURL=index.js.map