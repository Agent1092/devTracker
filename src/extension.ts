// src/extension.ts
import * as vscode from "vscode";
import {
  getLatestSnapshots,
  getLocalSummary,
  pingBackend,
  postFileChange,
  setBackendUrl,
  type LocalSummaryResponse,
  type SnapshotSummary,
} from "./apiClient";
import { registerSnapshotProvider } from "./snapshotProvider";
import { HistoryPanel } from "./historyPanel";

import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as path from "path";
import * as net from "net";
import * as fs from "fs";

let serverProc: ChildProcessWithoutNullStreams | null = null;
let backendUrl: string | null = null;

let installationId: string;
const changeTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => {
        if (typeof addr === "object" && addr) resolve(addr.port);
        else reject(new Error("no port"));
      });
    });
    srv.on("error", reject);
  });
}

function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    // ignore
  }
}

function getOrCreateInstallationId(context: vscode.ExtensionContext): string {
  const key = "devtracker.installationId";
  const existing = context.globalState.get<string>(key);
  if (existing) return existing;

  const newId = generatePseudoUuid();
  void context.globalState.update(key, newId);
  return newId;
}

async function startEmbeddedBackend(
  context: vscode.ExtensionContext
): Promise<string> {
  const port = await getFreePort();

  // Make sure global storage exists
  ensureDir(context.globalStorageUri.fsPath);

  const dbPath = path.join(context.globalStorageUri.fsPath, "devtracker.db");

  // IMPORTANT: This file must exist after TypeScript compile
  // src/server/cli.ts -> out/server/cli.js
  const serverEntry = context.asAbsolutePath(
    path.join("out", "server", "cli.js")
  );

  const proc = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      DEVTRACKER_DB_PATH: dbPath,
      DEVTRACKER_PORT: String(port),
    },
    stdio: "pipe",
    windowsHide: true,
  });

  serverProc = proc;

  proc.stderr.on("data", (d) =>
    console.error("[DevTracker server]", String(d))
  );
  proc.stdout.on("data", (d) =>
    console.log("[DevTracker server]", String(d))
  );

  return `http://127.0.0.1:${port}`;
}

async function waitForBackendReady(timeoutMs = 7000) {
  const start = Date.now();
  let lastErr: any = null;

  while (Date.now() - start < timeoutMs) {
    try {
      await pingBackend();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  throw lastErr ?? new Error("Backend not reachable");
}

export async function activate(context: vscode.ExtensionContext) {
  installationId = getOrCreateInstallationId(context);
  registerSnapshotProvider(context);

  // ✅ Start embedded backend ONCE, set URL, then wait until it responds
  try {
    backendUrl = await startEmbeddedBackend(context);
    setBackendUrl(backendUrl);
    await waitForBackendReady(15000);
  } catch (err: any) {
    vscode.window.showWarningMessage(
      `DevTracker: Could not start embedded backend. (${err?.message ?? err})`
    );
  }

  // Listener: capture changes (debounced)
  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (!event.document.uri.fsPath) return;
    scheduleSnapshotSend(event.document);
  });
  context.subscriptions.push(changeListener);

  context.subscriptions.push({
    dispose: () => {
      changeTimers.forEach((t) => clearTimeout(t));
      changeTimers.clear();
    },
  });

  // History panel
  const historyPanel = new HistoryPanel(context, installationId);
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.openHistoryPanel", async () => {
      await historyPanel.open();
    })
  );

  // Local summary
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.showLocalSummary", async () => {
      try {
        const summary: LocalSummaryResponse = await getLocalSummary(
          installationId,
          new Date()
        );

        const lines = [
          `Date: ${summary.date}`,
          `Total files touched: ${summary.total_files}`,
          "",
          ...summary.files.map((f) => `- ${f.path} (snapshots: ${f.snapshots})`),
        ];

        vscode.window.showInformationMessage(lines.join("\n"), { modal: true });
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `DevTracker: failed to load summary: ${err?.message ?? err}`
        );
      }
    })
  );

  // Quick diff picker
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.openRecentDiff", async () => {
      try {
        const snaps: SnapshotSummary[] = await getLatestSnapshots(
          installationId,
          60
        );

        if (!snaps.length) {
          vscode.window.showInformationMessage(
            "DevTracker: No snapshots found yet."
          );
          return;
        }

        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        const prettifyPath = (p: string) => {
          if (wsRoot && p.startsWith(wsRoot)) {
            const rel = p.slice(wsRoot.length).replace(/^\/+/, "");
            return rel.length ? rel : p;
          }
          return p;
        };

        const fileNameOf = (p: string) => p.split(/[/\\]/).pop() || p;

        const grouped = new Map<string, SnapshotSummary[]>();
        for (const s of snaps) {
          const arr = grouped.get(s.file_path) ?? [];
          arr.push(s);
          grouped.set(s.file_path, arr);
        }

        for (const [, arr] of grouped) {
          arr.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
        }

        type PickItem = vscode.QuickPickItem & {
          snapshotId?: number;
          filePath?: string;
        };
        const items: PickItem[] = [];

        const fileEntries = Array.from(grouped.entries()).sort(([, a], [, b]) => {
          const ta = new Date(a[0].created_at).getTime();
          const tb = new Date(b[0].created_at).getTime();
          return tb - ta;
        });

        for (const [filePath, versions] of fileEntries) {
          items.push({
            label: `📄 ${fileNameOf(filePath)}`,
            description: prettifyPath(filePath),
            kind: vscode.QuickPickItemKind.Separator,
          });

          for (const v of versions) {
            items.push({
              label: `   ⏱ ${new Date(v.created_at).toLocaleString()}`, // ✅ date+time
              description: "Open diff",
              snapshotId: v.id,
              filePath: v.file_path,
            });
          }
        }

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a file + time to open diff (grouped by file)",
          matchOnDescription: true,
        });

        if (!picked || !picked.snapshotId || !picked.filePath) return;

        const leftUri = vscode.Uri.parse(
          `devtracker-snapshot:/${picked.snapshotId}`
        );
        const rightUri = vscode.Uri.file(picked.filePath);

        await vscode.commands.executeCommand(
          "vscode.diff",
          leftUri,
          rightUri,
          `DevTracker Diff: ${prettifyPath(picked.filePath)}`
        );

        try {
          await vscode.commands.executeCommand(
            "workbench.action.compareEditor.nextChange"
          );
        } catch {
          // ignore
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `DevTracker: Diff failed: ${err?.message ?? err}`
        );
      }
    })
  );

  // Report Issue / Feedback
  context.subscriptions.push(
    vscode.commands.registerCommand("devtracker.reportIssue", async () => {
      const sys = {
        vscode: vscode.version,
        platform: process.platform,
        arch: process.arch,
        node: process.versions.node,
        extensionVersion: context.extension.packageJSON.version,
      };

      const body = encodeURIComponent(
        `### Bug report\n\n` +
          `**Describe the issue:**\n\n` +
          `\n\n---\n` +
          `**System Info**\n` +
          `\`\`\`json\n${JSON.stringify(sys, null, 2)}\n\`\`\`\n`
      );

      const url = `https://github.com/YOUR_GITHUB/devtracker/issues/new?body=${body}`;
      vscode.env.openExternal(vscode.Uri.parse(url));
    })
  );
}

export function deactivate() {
  try {
    serverProc?.kill();
  } catch {
    // ignore
  }
}

function scheduleSnapshotSend(document: vscode.TextDocument) {
  const filePath = document.uri.fsPath;
  if (!filePath) return;

  const existing = changeTimers.get(filePath);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    changeTimers.delete(filePath);

    postFileChange({
      installation_id: installationId,
      file_path: filePath,
      project_root:
        vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? null,
      content: document.getText(),
      timestamp: new Date().toISOString(),
    }).catch((err) =>
      console.error("DevTracker: failed to send change", err)
    );
  }, 2000);

  changeTimers.set(filePath, timeout);
}

function generatePseudoUuid(): string {
  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
  );
  return [
    bytes.slice(0, 4),
    bytes.slice(4, 6),
    bytes.slice(6, 8),
    bytes.slice(8, 10),
    bytes.slice(10, 16),
  ]
    .map((chunk) =>
      chunk.map((b) => b.toString(16).padStart(2, "0")).join("")
    )
    .join("-");
}
