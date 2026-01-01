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
exports.runBulkRevertWizard = runBulkRevertWizard;
exports.runBulkRevertForFolder = runBulkRevertForFolder;
// src/bulkRevert.ts
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const apiClient_1 = require("./apiClient");
const session_1 = require("./session");
const session_2 = require("./session");
function normalize(p) {
    return p.replace(/\\/g, "/");
}
function getFolderCandidates(filePaths, wsRoot) {
    const folders = new Set();
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
function isUnderFolder(filePathAbs, folderRel, wsRoot) {
    if (wsRoot) {
        const nRoot = normalize(wsRoot).replace(/\/+$/, "");
        if (!folderRel)
            return normalize(filePathAbs).startsWith(nRoot + "/");
    }
    const nAbs = normalize(filePathAbs);
    if (!wsRoot)
        return nAbs.includes(`/${folderRel}/`) || nAbs.endsWith(`/${folderRel}`);
    const nRoot = normalize(wsRoot).replace(/\/+$/, "");
    const prefix = `${nRoot}/${folderRel}`.replace(/\/+$/, "");
    return nAbs === prefix || nAbs.startsWith(prefix + "/");
}
/**
 * Bulk revert "undo last session" for files under a folder.
 * Strategy: for each file, find the latest snapshot strictly BEFORE lastSession.startIso.
 * If none exists, skip that file.
 */
async function runBulkRevertWizard(opts) {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsRoot) {
        vscode.window.showErrorMessage("DevTracker: Open a workspace folder to use Bulk Revert.");
        return;
    }
    // ...
    const last = (0, session_1.getLastSessionWindow)(opts.ctx);
    let startIso = last?.startIso ?? null;
    // fallback: “undo current session”
    if (!startIso)
        startIso = (0, session_2.getCurrentSessionStart)(opts.ctx);
    if (!startIso) {
        vscode.window.showInformationMessage("DevTracker: Session tracking not ready yet. Restart VS Code once.");
        return;
    }
    let snaps = [];
    try {
        snaps = await (0, apiClient_1.getLatestSnapshots)(opts.installationId, 500);
    }
    catch (e) {
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
    const pickedFolder = await vscode.window.showQuickPick(folders.map(f => ({ label: f, description: "Revert files in this folder" })), { placeHolder: "Choose a folder to bulk revert (undo last session)" });
    if (!pickedFolder)
        return;
    const folderRel = pickedFolder.label;
    const startT = new Date(startIso).getTime();
    // Group snapshots by file
    const byFile = new Map();
    for (const s of snaps) {
        if (!isUnderFolder(s.file_path, folderRel, wsRoot))
            continue;
        const arr = byFile.get(s.file_path) ?? [];
        arr.push(s);
        byFile.set(s.file_path, arr);
    }
    if (byFile.size === 0) {
        vscode.window.showInformationMessage(`DevTracker: No recent files found under "${folderRel}".`);
        return;
    }
    // For each file, choose snapshot to restore = latest before last session start
    const restorePlan = [];
    for (const [filePath, arr] of byFile.entries()) {
        // sort descending by time
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const candidate = arr.find(s => new Date(s.created_at).getTime() < startT);
        if (candidate)
            restorePlan.push({ filePath, snapshotId: candidate.id });
    }
    if (!restorePlan.length) {
        vscode.window.showInformationMessage(`DevTracker: No “pre-session” snapshots available to revert under "${folderRel}".`);
        return;
    }
    const confirm = await vscode.window.showWarningMessage(`Bulk Revert will overwrite ${restorePlan.length} file(s) under "${folderRel}". Continue?`, { modal: true }, "Revert");
    if (confirm !== "Revert")
        return;
    const progressOpts = {
        location: vscode.ProgressLocation.Notification,
        title: `DevTracker: Reverting ${restorePlan.length} files…`,
        cancellable: false,
    };
    await vscode.window.withProgress(progressOpts, async (progress) => {
        let done = 0;
        for (const item of restorePlan) {
            try {
                const detail = await (0, apiClient_1.getSnapshot)(item.snapshotId);
                const uri = vscode.Uri.file(item.filePath);
                // Ensure directory exists (should, but safe)
                const dir = path.dirname(item.filePath);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
                await vscode.workspace.fs.writeFile(uri, Buffer.from(detail.full_text ?? "", "utf8"));
            }
            catch {
                // skip errors but continue
            }
            finally {
                done++;
                progress.report({ message: `${done}/${restorePlan.length}` });
            }
        }
    });
    vscode.window.showInformationMessage(`DevTracker: Bulk revert complete for "${folderRel}".`);
}
async function runBulkRevertForFolder(opts) {
    const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!wsRoot) {
        vscode.window.showErrorMessage("DevTracker: Open a workspace folder to use Bulk Revert.");
        return;
    }
    // Prefer last session start; fallback to current session start.
    const last = (0, session_1.getLastSessionWindow)(opts.ctx);
    let startIso = last?.startIso ?? (0, session_2.getCurrentSessionStart)(opts.ctx);
    if (!startIso) {
        vscode.window.showInformationMessage("DevTracker: Session tracking not ready yet. Restart VS Code once.");
        return;
    }
    let snaps = [];
    try {
        snaps = await (0, apiClient_1.getLatestSnapshots)(opts.installationId, 500);
    }
    catch (e) {
        vscode.window.showErrorMessage(`DevTracker: Failed to load snapshots. ${e?.message ?? e}`);
        return;
    }
    const startT = new Date(startIso).getTime();
    // Group snapshots by file under the folder
    const byFile = new Map();
    for (const s of snaps) {
        if (!isUnderFolder(s.file_path, opts.folderRel, wsRoot))
            continue;
        const arr = byFile.get(s.file_path) ?? [];
        arr.push(s);
        byFile.set(s.file_path, arr);
    }
    if (byFile.size === 0) {
        vscode.window.showInformationMessage(`DevTracker: No tracked files found under "${opts.folderRel}".`);
        return;
    }
    const restorePlan = [];
    for (const [filePath, arr] of byFile.entries()) {
        arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const candidate = arr.find(s => new Date(s.created_at).getTime() < startT);
        if (candidate)
            restorePlan.push({ filePath, snapshotId: candidate.id });
    }
    if (!restorePlan.length) {
        vscode.window.showInformationMessage(`DevTracker: No pre-session snapshots available to revert under "${opts.folderRel}".`);
        return;
    }
    const confirm = await vscode.window.showWarningMessage(`Bulk Revert will overwrite ${restorePlan.length} file(s) under "${opts.folderRel}". Continue?`, { modal: true }, "Revert");
    if (confirm !== "Revert")
        return;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `DevTracker: Reverting ${restorePlan.length} files…`,
        cancellable: false,
    }, async (progress) => {
        let done = 0;
        for (const item of restorePlan) {
            try {
                const detail = await (0, apiClient_1.getSnapshot)(item.snapshotId);
                const uri = vscode.Uri.file(item.filePath);
                const dir = path.dirname(item.filePath);
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(dir));
                await vscode.workspace.fs.writeFile(uri, Buffer.from(detail.full_text ?? "", "utf8"));
            }
            catch {
                // continue
            }
            finally {
                done++;
                progress.report({ message: `${done}/${restorePlan.length}` });
            }
        }
    });
    vscode.window.showInformationMessage(`DevTracker: Bulk revert complete for "${opts.folderRel}".`);
}
//# sourceMappingURL=bulkRevert.js.map