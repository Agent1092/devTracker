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
exports.runStartupNotifications = runStartupNotifications;
// src/notifications.ts
const vscode = __importStar(require("vscode"));
const session_1 = require("./session");
const apiClient_1 = require("./apiClient");
const KEY_LAST_SHOWN_SESSION = "devtracker.notif.lastSessionShownEnd";
async function runStartupNotifications(ctx, installationId) {
    const enabled = vscode.workspace
        .getConfiguration()
        .get("devtracker.notifications.startup", true);
    if (!enabled)
        return;
    const last = (0, session_1.getLastSessionWindow)(ctx);
    if (!last)
        return;
    const lastShown = ctx.globalState.get(KEY_LAST_SHOWN_SESSION);
    if (lastShown === last.endIso)
        return;
    let snaps = [];
    try {
        snaps = await (0, apiClient_1.getLatestSnapshots)(installationId, 300);
    }
    catch {
        return;
    }
    const fromT = new Date(last.startIso).getTime();
    const toT = new Date(last.endIso).getTime();
    const inWindow = snaps.filter((s) => {
        const t = new Date(s.created_at).getTime();
        return t >= fromT && t <= toT;
    });
    if (!inWindow.length)
        return;
    const counts = new Map();
    for (const s of inWindow)
        counts.set(s.file_path, (counts.get(s.file_path) ?? 0) + 1);
    const top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([p, n]) => `${fileName(p)} (${n})`)
        .join(", ");
    const msg = `DevTracker • Last session: ${inWindow.length} snapshots across ${counts.size} files.` +
        (top ? ` Top: ${top}` : "");
    const OPEN = "Open DevTracker";
    const DISABLE = "Disable popups";
    const picked = await vscode.window.showInformationMessage(msg, OPEN, DISABLE);
    if (picked === OPEN) {
        await vscode.commands.executeCommand("devtracker.openHistoryPanel");
    }
    else if (picked === DISABLE) {
        await vscode.workspace
            .getConfiguration()
            .update("devtracker.notifications.startup", false, vscode.ConfigurationTarget.Global);
    }
    await ctx.globalState.update(KEY_LAST_SHOWN_SESSION, last.endIso);
}
function fileName(p) {
    return p.split(/[/\\]/).pop() || p;
}
//# sourceMappingURL=notifications.js.map