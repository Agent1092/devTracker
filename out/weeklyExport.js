"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportWeeklyInsight = exportWeeklyInsight;
exports.exportMonthlyInsight = exportMonthlyInsight;
// src/weeklyExport.ts
const vscode = __importStar(require("vscode"));
const apiClient_1 = require("./apiClient");
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function norm(p) {
    return (p || "").replace(/\\/g, "/");
}
function fmtDate(d) {
    return d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
// ✅ ES2020-safe (no replaceAll)
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function baseName(p) {
    const n = String(p || "").replace(/\\/g, "/").replace(/\/+$/, "");
    const parts = n.split("/").filter(Boolean);
    return parts[parts.length - 1] || n;
}
function extOf(abs) {
    const b = baseName(abs);
    const i = b.lastIndexOf(".");
    return i >= 0 ? b.slice(i + 1).toLowerCase() : "";
}
/**
 * Lightweight "project root" guess for global overview.
 * We avoid disk reads in free version; just segment-based heuristics.
 */
function guessProjectRoot(absPath) {
    const p = norm(absPath);
    const parts = p.split("/").filter(Boolean);
    // /home/user/... or /Users/user/...
    if (p.startsWith("/home/") || p.startsWith("/Users/")) {
        const isHome = parts[0] === "home" || parts[0] === "Users";
        const afterUser = isHome ? 2 : 0;
        // config-ish (keep shorter)
        const configIdx = parts.findIndex((x) => x === ".config" || x === ".vscode" || x === ".local");
        if (configIdx >= 0) {
            // /home/u/.config/Code - OSS/...
            const keep = Math.min(parts.length, configIdx + 3);
            return "/" + parts.slice(0, keep).join("/");
        }
        // Normal dev paths: take /home/u + 4 segments -> /home/u/Documents/codes/proj
        const keep = Math.min(parts.length, afterUser + 4);
        return "/" + parts.slice(0, keep).join("/");
    }
    // fallback: first 4 segments
    return "/" + parts.slice(0, Math.min(parts.length, 4)).join("/");
}
function intensity(totalSnapshots) {
    if (totalSnapshots <= 5)
        return "Quick touch";
    if (totalSnapshots <= 20)
        return "Steady sessions";
    return "Deep work";
}
function detectNatureFromAbs(files) {
    let tests = 0;
    let docs = 0;
    let config = 0;
    let code = 0;
    for (const f of files) {
        const p = norm(f.path).toLowerCase();
        const ext = extOf(p);
        const w = f.snapshots ?? 1;
        if (p.indexOf("/test") >= 0 || p.indexOf(".spec.") >= 0 || p.indexOf(".test.") >= 0)
            tests += w;
        if (ext === "md")
            docs += w;
        if (ext === "json" ||
            ext === "yml" ||
            ext === "yaml" ||
            ext === "toml" ||
            ext === "ini" ||
            ext === "properties" ||
            ext === "gradle")
            config += w;
        if (ext === "ts" ||
            ext === "tsx" ||
            ext === "js" ||
            ext === "jsx" ||
            ext === "java" ||
            ext === "kt" ||
            ext === "kts" ||
            ext === "py" ||
            ext === "go" ||
            ext === "rs" ||
            ext === "c" ||
            ext === "cpp" ||
            ext === "hpp" ||
            ext === "cs" ||
            ext === "css" ||
            ext === "scss" ||
            ext === "html")
            code += w;
    }
    const total = tests + docs + config + code;
    if (total <= 0)
        return "General updates";
    const pct = (x) => x / total;
    if (pct(tests) > 0.45)
        return "Mostly testing & verification";
    if (pct(config) > 0.35)
        return "Mostly configuration & wiring";
    if (pct(docs) > 0.35)
        return "Mostly documentation & notes";
    if (pct(code) > 0.55)
        return "Mostly coding & refactoring";
    return "Mixed development work";
}
function netProgressHint(nature, filesTouched) {
    if (nature.indexOf("testing") >= 0)
        return "Confidence & stability improved";
    if (nature.indexOf("configuration") >= 0)
        return "Wiring & integration progressed";
    if (nature.indexOf("documentation") >= 0)
        return "Clarity & handoff improved";
    if (filesTouched >= 20)
        return "Broad cleanup & forward momentum";
    if (filesTouched <= 5)
        return "Small but meaningful progress";
    return "Steady progress & cleanup";
}
function buildWebviewHtml(nonce) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>DevTracker Reflection</title>
<style>
  :root{
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: rgba(255,255,255,.10);
    --hover: var(--vscode-list-hoverBackground);
    --active: var(--vscode-list-activeSelectionBackground);
    --activeFg: var(--vscode-list-activeSelectionForeground);
  }
  body{ margin:0; padding:14px; background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto; }
  h2{ margin:0 0 4px; }
  .muted{ color:var(--muted); font-size:12px; }
  .card{ border:1px solid var(--border); border-radius:14px; padding:12px; margin-top:12px; }
  .row{ display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; }
  .pill{ border:1px solid var(--border); border-radius:999px; padding:6px 10px; font-size:12px; }

  .grid4{
    display:grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap:12px;
    margin-top:12px;
  }
  @media (max-width: 900px){ .grid4{ grid-template-columns: 1fr 1fr; } }
  .hi{
    border:1px solid var(--border);
    border-radius:14px;
    padding:10px 12px;
  }
  .hiTitle{ font-weight:900; font-size:12px; opacity:.9; }
  .hiVal{ margin-top:6px; font-size:18px; font-weight:900; }
  .hiSub{ margin-top:4px; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  .grid{ display:grid; grid-template-columns: 360px 1fr; gap:12px; margin-top:12px; height: calc(100vh - 290px); }
  @media (max-width: 900px){ .grid{ grid-template-columns: 1fr; height:auto; } }
  .pane{ border:1px solid var(--border); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; min-height:0; }
  .paneHeader{ padding:10px 12px; font-weight:900; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .paneBody{ overflow:auto; padding:10px; min-height:0; }
  .item{ padding:8px 10px; border-radius:12px; cursor:pointer; }
  .item:hover{ background:var(--hover); }
  .item.active{ background:var(--active); color:var(--activeFg); }
  .itemTitle{ font-weight:900; font-size:12px; }
  .itemSub{ font-size:11px; color:var(--muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .badge{ font-size:11px; border:1px solid var(--border); padding:2px 8px; border-radius:999px; color:var(--muted); }
  .empty{ color:var(--muted); padding:10px; }
  .search{ width:100%; padding:8px 10px; border-radius:10px; border:1px solid var(--border); background:transparent; color:var(--fg); outline:none; }
  .hintTag{
    border:1px solid var(--border);
    border-radius:999px;
    padding:4px 10px;
    font-size:11px;
    color:var(--muted);
  }
  .rightMode{
    display:flex; gap:8px; align-items:center;
  }
  .toggle{
    border:1px solid var(--border);
    background:transparent;
    color:var(--fg);
    padding:4px 10px;
    border-radius:999px;
    cursor:pointer;
    font-weight:900;
    font-size:11px;
  }
  .toggle.active{ background:var(--active); color:var(--activeFg); border-color:transparent; }
</style>
</head>
<body>
  <div>
    <h2 id="title">📌 Reflection</h2>
    <div id="range" class="muted"></div>
  </div>

  <div class="card">
    <div class="row" id="pills1"></div>
    <div class="row" id="pills2" style="margin-top:8px;"></div>
  </div>

  <div class="grid4" id="highlights"></div>

  <div class="grid">
    <div class="pane">
      <div class="paneHeader">
        <div>
          <div>Top Projects (Global)</div>
          <div class="muted" style="margin-top:2px;">Collapsed list, system-wide</div>
        </div>
        <div class="badge" id="projCount">0</div>
      </div>
      <div class="paneBody">
        <input id="search" class="search" placeholder="Search project/file path..." />
        <div id="projects" style="margin-top:10px;"></div>
      </div>
    </div>

    <div class="pane">
      <div class="paneHeader">
        <div>
          <div id="rightTitle">Top Files (Global)</div>
          <div class="muted" id="rightSub" style="margin-top:2px;"></div>
        </div>
        <div class="rightMode">
          <button id="modeGlobal" class="toggle active" title="Show top files across all projects">Global</button>
          <button id="modeProject" class="toggle" title="Show files only for selected project">Project</button>
          <div class="badge" id="fileCount">0</div>
        </div>
      </div>
      <div class="paneBody" id="files"></div>
    </div>
  </div>

  <div class="muted" style="margin-top:12px;">
    DevTracker is local-first. This reflection is generated from snapshots (no AI).
  </div>

<script nonce="${nonce}">
  let state = {
    title: "",
    range: "",
    pills1: [],
    pills2: [],
    highlights: null,
    projects: [],
    topFilesGlobal: []
  };

  const elTitle = document.getElementById("title");
  const elRange = document.getElementById("range");
  const elPills1 = document.getElementById("pills1");
  const elPills2 = document.getElementById("pills2");
  const elHi = document.getElementById("highlights");

  const elProjects = document.getElementById("projects");
  const elFiles = document.getElementById("files");
  const elProjCount = document.getElementById("projCount");
  const elFileCount = document.getElementById("fileCount");
  const elRightTitle = document.getElementById("rightTitle");
  const elRightSub = document.getElementById("rightSub");
  const elSearch = document.getElementById("search");

  const btnGlobal = document.getElementById("modeGlobal");
  const btnProject = document.getElementById("modeProject");

  let selectedRoot = "";
  let rightMode = "global"; // global | project

  btnGlobal.addEventListener("click", () => {
    rightMode = "global";
    btnGlobal.classList.add("active");
    btnProject.classList.remove("active");
    render();
  });
  btnProject.addEventListener("click", () => {
    rightMode = "project";
    btnProject.classList.add("active");
    btnGlobal.classList.remove("active");
    render();
  });

  elSearch.addEventListener("input", () => render());

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type !== "data") return;

    state = msg.payload;
    selectedRoot = (state.projects && state.projects[0] && state.projects[0].root) ? state.projects[0].root : "";
    render();
  });

  function pill(text){
    const d = document.createElement("div");
    d.className = "pill";
    d.innerHTML = text;
    return d;
  }

  function renderHighlights(){
    const h = state.highlights || {};
    elHi.innerHTML = \`
      <div class="hi">
        <div class="hiTitle">Top project</div>
        <div class="hiVal">\${escapeHtml(h.topProjectName || "—")}</div>
        <div class="hiSub">\${escapeHtml(h.topProjectPath || "")}</div>
      </div>
      <div class="hi">
        <div class="hiTitle">Most touched file</div>
        <div class="hiVal">\${escapeHtml(h.topFileName || "—")}</div>
        <div class="hiSub">\${escapeHtml(h.topFilePath || "")}</div>
      </div>
      <div class="hi">
        <div class="hiTitle">Peak day</div>
        <div class="hiVal">\${escapeHtml(h.peakDay || "—")}</div>
        <div class="hiSub">\${escapeHtml(h.peakDayCount ? (h.peakDayCount + " snapshots") : "")}</div>
      </div>
      <div class="hi">
        <div class="hiTitle">Top filetype</div>
        <div class="hiVal">\${escapeHtml(h.topExt || "—")}</div>
        <div class="hiSub">\${escapeHtml(h.topExtCount ? (h.topExtCount + " snapshots") : "")}</div>
      </div>
    \`;
  }

  function render(){
    elTitle.textContent = "📌 " + (state.title || "Reflection");
    elRange.textContent = state.range || "";

    elPills1.innerHTML = "";
    (state.pills1 || []).forEach(p => elPills1.appendChild(pill(p)));

    elPills2.innerHTML = "";
    (state.pills2 || []).forEach(p => elPills2.appendChild(pill(p)));

    renderHighlights();

    const q = (elSearch.value || "").trim().toLowerCase();

    // Filter projects by search (root or any file match)
    const projsAll = state.projects || [];
    const projs = projsAll.filter(p => {
      if (!q) return true;
      if (String(p.root).toLowerCase().indexOf(q) >= 0) return true;
      const files = p.files || [];
      for (let i=0;i<files.length;i++){
        if (String(files[i].path).toLowerCase().indexOf(q) >= 0) return true;
      }
      return false;
    });

    elProjCount.textContent = String(projs.length);

    elProjects.innerHTML = "";
    if (!projs.length){
      elProjects.innerHTML = '<div class="empty">No activity in this range.</div>';
      elFiles.innerHTML = '<div class="empty">No files to show.</div>';
      elFileCount.textContent = "0";
      elRightSub.textContent = "";
      return;
    }

    // Keep selectedRoot valid
    const selectedExists = projs.some(p => p.root === selectedRoot);
    if (!selectedExists) selectedRoot = projs[0].root;

    // Render project list
    for (let i=0;i<projs.length;i++){
      const p = projs[i];
      const div = document.createElement("div");
      div.className = "item" + (p.root === selectedRoot ? " active" : "");
      div.onclick = () => { selectedRoot = p.root; if (rightMode === "project") render(); };

      div.innerHTML = \`
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div class="itemTitle">📁 \${escapeHtml(baseName(p.root))}</div>
          <div class="badge">\${p.count}</div>
        </div>
        <div class="itemSub">\${escapeHtml(p.root)}</div>
      \`;
      elProjects.appendChild(div);
    }

    // Right panel: Global top files or selected project files
    let filesToShow = [];
    if (rightMode === "global") {
      elRightTitle.textContent = "Top Files (Global)";
      elRightSub.textContent = "All projects combined";
      filesToShow = (state.topFilesGlobal || []).slice();
    } else {
      const active = projs.find(p => p.root === selectedRoot) || projs[0];
      elRightTitle.textContent = "Files in: " + baseName(active.root);
      elRightSub.textContent = active.root;
      filesToShow = (active.files || []).slice();
    }

    if (q) {
      filesToShow = filesToShow.filter(f => String(f.path).toLowerCase().indexOf(q) >= 0);
    }

    elFileCount.textContent = String(filesToShow.length);

    elFiles.innerHTML = "";
    if (!filesToShow.length){
      elFiles.innerHTML = '<div class="empty">No files to show.</div>';
      return;
    }

    // cap for perf
    filesToShow.slice(0, 250).forEach(f => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = \`
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div class="itemTitle">📄 \${escapeHtml(baseName(f.path))}</div>
          <div class="badge">\${f.count}</div>
        </div>
        <div class="itemSub">\${escapeHtml(f.path)}</div>
      \`;
      elFiles.appendChild(div);
    });
  }

  function baseName(p){
    const n = String(p || "").replace(/\\\\/g,"/").replace(/\\/+$/, "");
    const parts = n.split("/").filter(Boolean);
    return parts[parts.length-1] || n;
  }

  function escapeHtml(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }
</script>
</body>
</html>`;
}
async function openRangeReflectionWebview(installationId, mode) {
    const now = new Date();
    const daysBack = mode === "week" ? 6 : 29;
    const start = startOfDay(addDays(now, -daysBack));
    const end = addDays(startOfDay(now), 1);
    const snaps = await (0, apiClient_1.getLatestSnapshots)(installationId, 20000);
    // GLOBAL range filter (no workspace filtering)
    const inRange = snaps.filter((s) => {
        const t = new Date(s.created_at);
        return t >= start && t < end;
    });
    // group by file
    const byFile = new Map();
    const byDay = new Map();
    const byExt = new Map();
    for (const s of inRange) {
        const abs = norm(s.file_path);
        byFile.set(abs, (byFile.get(abs) ?? 0) + 1);
        const dayKey = String(s.created_at).slice(0, 10);
        byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + 1);
        const e = extOf(abs) || "(none)";
        byExt.set(e, (byExt.get(e) ?? 0) + 1);
    }
    const filesTouched = byFile.size;
    const totalSnapshots = inRange.length;
    const topFilesAbs = [...byFile.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, mode === "week" ? 20 : 35)
        .map(([path, count]) => ({ path, snapshots: count }));
    const nature = detectNatureFromAbs(topFilesAbs);
    const netProgress = netProgressHint(nature, filesTouched);
    const activeDays = [...byDay.values()].filter((n) => n > 0).length;
    const avgPerActiveDay = activeDays ? Math.round(totalSnapshots / activeDays) : 0;
    // Peak day
    const peak = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const peakDay = peak ? peak[0] : "";
    const peakDayCount = peak ? peak[1] : 0;
    // Top ext
    const topExtPair = [...byExt.entries()].sort((a, b) => b[1] - a[1])[0];
    const topExt = topExtPair ? topExtPair[0] : "";
    const topExtCount = topExtPair ? topExtPair[1] : 0;
    // group by project roots
    const byRoot = new Map();
    for (const [abs, count] of byFile.entries()) {
        const root = guessProjectRoot(abs);
        const cur = byRoot.get(root) ?? { count: 0, files: new Map() };
        cur.count += count;
        cur.files.set(abs, count);
        byRoot.set(root, cur);
    }
    const projects = [...byRoot.entries()]
        .map(([root, v]) => ({
        root,
        count: v.count,
        files: [...v.files.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 200)
            .map(([path, c]) => ({ path, count: c })),
    }))
        .sort((a, b) => b.count - a.count);
    const topProject = projects[0];
    const topFilePair = [...byFile.entries()].sort((a, b) => b[1] - a[1])[0];
    const title = mode === "week" ? "Weekly Reflection" : "Monthly Reflection";
    const rangeLabel = `Range: ${fmtDate(start)} → ${fmtDate(addDays(end, -1))}`;
    const nonce = String(Date.now());
    const panel = vscode.window.createWebviewPanel(mode === "week" ? "devtracker.weeklyReflection" : "devtracker.monthlyReflection", `DevTracker — ${title}`, vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    panel.webview.html = buildWebviewHtml(nonce);
    // global top files list (for right panel default)
    const topFilesGlobal = [...byFile.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 250)
        .map(([path, count]) => ({ path, count }));
    panel.webview.postMessage({
        type: "data",
        payload: {
            title,
            range: rangeLabel,
            pills1: [
                `Files touched: <b>${filesTouched}</b>`,
                `Snapshots: <b>${totalSnapshots}</b>`,
                `Active days: <b>${activeDays}</b> <span style="opacity:.7">(${avgPerActiveDay}/day)</span>`,
                `Intensity: <b>${escapeHtml(intensity(totalSnapshots))}</b>`,
            ],
            pills2: [
                `Scope: <b>Global</b>`,
                `Nature: <b>${escapeHtml(nature)}</b>`,
                `Net progress: <b>${escapeHtml(netProgress)}</b>`,
            ],
            highlights: {
                topProjectName: topProject ? baseName(topProject.root) : "",
                topProjectPath: topProject ? topProject.root : "",
                topFileName: topFilePair ? baseName(topFilePair[0]) : "",
                topFilePath: topFilePair ? topFilePair[0] : "",
                peakDay: peakDay,
                peakDayCount: peakDayCount,
                topExt: topExt,
                topExtCount: topExtCount,
            },
            projects,
            topFilesGlobal,
        },
    });
}
async function exportWeeklyInsight(installationId) {
    return openRangeReflectionWebview(installationId, "week");
}
async function exportMonthlyInsight(installationId) {
    return openRangeReflectionWebview(installationId, "month");
}
//# sourceMappingURL=weeklyExport.js.map