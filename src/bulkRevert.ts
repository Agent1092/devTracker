// src/bulkRevert.ts
import * as vscode from "vscode";
import * as path from "path";
import { getLatestSnapshots, getSnapshot, type SnapshotSummary } from "./apiClient";
import { getLastSessionWindow } from "./session";
import { getCurrentSessionStart } from "./session";


function normalize(p: string) {
  return p.replace(/\\/g, "/");
}

function getFolderCandidates(filePaths: string[], wsRoot?: string) {
  const folders = new Set<string>();

  for (const abs of filePaths) {
    const nAbs = normalize(abs);
    let rel = nAbs;

    if (wsRoot) {
      const nRoot = normalize(wsRoot).replace(/\/+$/, "");
      if (nAbs.startsWith(nRoot + "/")) {
        rel = nAbs.slice(nRoot.length + 1);
      }
    }

    const parts = rel.split("/").filter(Boolean);
    // Build folder levels: "src", "src/server", ...
    for (let i = 1; i < Math.min(parts.length, 5); i++) {
      folders.add(parts.slice(0, i).join("/"));
    }
  }

  return [...folders].sort((a, b) => a.localeCompare(b));
}

function isUnderFolder(filePathAbs: string, folderRel: string, wsRoot?: string) {
  if (wsRoot) {
  const nRoot = normalize(wsRoot).replace(/\/+$/, "");
  if (!folderRel) return normalize(filePathAbs).startsWith(nRoot + "/");
}

  const nAbs = normalize(filePathAbs);
  if (!wsRoot) return nAbs.includes(`/${folderRel}/`) || nAbs.endsWith(`/${folderRel}`);

  const nRoot = normalize(wsRoot).replace(/\/+$/, "");
  const prefix = `${nRoot}/${folderRel}`.replace(/\/+$/, "");
  return nAbs === prefix || nAbs.startsWith(prefix + "/");
}

/**
 * Bulk revert "undo last session" for files under a folder.
 * Strategy: for each file, find the latest snapshot strictly BEFORE lastSession.startIso.
 * If none exists, skip that file.
 */
export async function runBulkRevertWizard(opts: {
  ctx: vscode.ExtensionContext;
  installationId: string;
}) {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) {
    vscode.window.showErrorMessage("DevTracker: Open a workspace folder to use Bulk Revert.");
    return;
  }


    // ...
    const last = getLastSessionWindow(opts.ctx);
    let startIso = last?.startIso ?? null;

    // fallback: “undo current session”
    if (!startIso) startIso = getCurrentSessionStart(opts.ctx);

    if (!startIso) {
      vscode.window.showInformationMessage("DevTracker: Session tracking not ready yet. Restart VS Code once.");
      return;
    }


  let snaps: SnapshotSummary[] = [];
  try {
    snaps = await getLatestSnapshots(opts.installationId, 500);
  } catch (e: any) {
    vscode.window.showErrorMessage(`DevTracker: Failed to load snapshots. ${e?.message ?? e}`);
    return;
  }

  if (!snaps.length) {
    vscode.window.showInformationMessage("DevTracker: No snapshots found yet.");
    return;
  }

  // Folder list derived from snapshot file paths
  const folders = getFolderCandidates(snaps.map(s => s.file_path), wsRoot);
  if (!folders.length) {
    vscode.window.showInformationMessage("DevTracker: No folders found in recent activity.");
    return;
  }

  const pickedFolder = await vscode.window.showQuickPick(
    folders.map(f => ({ label: f, description: "Revert files in this folder" })),
    { placeHolder: "Choose a folder to bulk revert (undo last session)" }
  );
  if (!pickedFolder) return;

  const folderRel = pickedFolder.label;

const startT = new Date(startIso).getTime();

  // Group snapshots by file
  const byFile = new Map<string, SnapshotSummary[]>();
  for (const s of snaps) {
    if (!isUnderFolder(s.file_path, folderRel, wsRoot)) continue;
    const arr = byFile.get(s.file_path) ?? [];
    arr.push(s);
    byFile.set(s.file_path, arr);
  }

  if (byFile.size === 0) {
    vscode.window.showInformationMessage(`DevTracker: No recent files found under "${folderRel}".`);
    return;
  }

  // For each file, choose snapshot to restore = latest before last session start
  const restorePlan: { filePath: string; snapshotId: number }[] = [];

  for (const [filePath, arr] of byFile.entries()) {
    // sort descending by time
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const candidate = arr.find(s => new Date(s.created_at).getTime() < startT);
    if (candidate) restorePlan.push({ filePath, snapshotId: candidate.id });
  }

  if (!restorePlan.length) {
    vscode.window.showInformationMessage(
      `DevTracker: No “pre-session” snapshots available to revert under "${folderRel}".`
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Bulk Revert will overwrite ${restorePlan.length} file(s) under "${folderRel}". Continue?`,
    { modal: true },
    "Revert"
  );
  if (confirm !== "Revert") return;

  const progressOpts: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Notification,
    title: `DevTracker: Reverting ${restorePlan.length} files…`,
    cancellable: false,
  };

  await vscode.window.withProgress(progressOpts, async (progress) => {
    let done = 0;

    for (const item of restorePlan) {
      try {
        const detail = await getSnapshot(item.snapshotId);
        const uri = vscode.Uri.file(item.filePath);

        // Ensure directory exists (should, but safe)
        const dir = path.dirname(item.filePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));

        await vscode.workspace.fs.writeFile(uri, Buffer.from(detail.full_text ?? "", "utf8"));
      } catch {
        // skip errors but continue
      } finally {
        done++;
        progress.report({ message: `${done}/${restorePlan.length}` });
      }
    }
  });

  vscode.window.showInformationMessage(
    `DevTracker: Bulk revert complete for "${folderRel}".`
  );
}


export async function runBulkRevertForFolder(opts: {
  ctx: vscode.ExtensionContext;
  installationId: string;
  folderRel: string; // like "src" or "src/server"
}) {
  const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!wsRoot) {
    vscode.window.showErrorMessage("DevTracker: Open a workspace folder to use Bulk Revert.");
    return;
  }

  // Prefer last session start; fallback to current session start.
  const last = getLastSessionWindow(opts.ctx);
  let startIso = last?.startIso ?? getCurrentSessionStart(opts.ctx);
  if (!startIso) {
    vscode.window.showInformationMessage("DevTracker: Session tracking not ready yet. Restart VS Code once.");
    return;
  }

  let snaps: SnapshotSummary[] = [];
  try {
    snaps = await getLatestSnapshots(opts.installationId, 500);
  } catch (e: any) {
    vscode.window.showErrorMessage(`DevTracker: Failed to load snapshots. ${e?.message ?? e}`);
    return;
  }

  const startT = new Date(startIso).getTime();

  // Group snapshots by file under the folder
  const byFile = new Map<string, SnapshotSummary[]>();
  for (const s of snaps) {
    if (!isUnderFolder(s.file_path, opts.folderRel, wsRoot)) continue;
    const arr = byFile.get(s.file_path) ?? [];
    arr.push(s);
    byFile.set(s.file_path, arr);
  }

  if (byFile.size === 0) {
    vscode.window.showInformationMessage(`DevTracker: No tracked files found under "${opts.folderRel}".`);
    return;
  }

  const restorePlan: { filePath: string; snapshotId: number }[] = [];
  for (const [filePath, arr] of byFile.entries()) {
    arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const candidate = arr.find(s => new Date(s.created_at).getTime() < startT);
    if (candidate) restorePlan.push({ filePath, snapshotId: candidate.id });
  }

  if (!restorePlan.length) {
    vscode.window.showInformationMessage(
      `DevTracker: No pre-session snapshots available to revert under "${opts.folderRel}".`
    );
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Bulk Revert will overwrite ${restorePlan.length} file(s) under "${opts.folderRel}". Continue?`,
    { modal: true },
    "Revert"
  );
  if (confirm !== "Revert") return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DevTracker: Reverting ${restorePlan.length} files…`,
      cancellable: false,
    },
    async (progress) => {
      let done = 0;
      for (const item of restorePlan) {
        try {
          const detail = await getSnapshot(item.snapshotId);
          const uri = vscode.Uri.file(item.filePath);
          const dir = path.dirname(item.filePath);
          await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
          await vscode.workspace.fs.writeFile(uri, Buffer.from(detail.full_text ?? "", "utf8"));
        } catch {
          // continue
        } finally {
          done++;
          progress.report({ message: `${done}/${restorePlan.length}` });
        }
      }
    }
  );

  vscode.window.showInformationMessage(`DevTracker: Bulk revert complete for "${opts.folderRel}".`);
}