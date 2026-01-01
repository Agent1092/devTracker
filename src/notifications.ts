// src/notifications.ts
import * as vscode from "vscode";
import { getLastSessionWindow } from "./session";
import { getLatestSnapshots, type SnapshotSummary } from "./apiClient";

const KEY_LAST_SHOWN_SESSION = "devtracker.notif.lastSessionShownEnd";

export async function runStartupNotifications(
  ctx: vscode.ExtensionContext,
  installationId: string
) {
  const enabled = vscode.workspace
    .getConfiguration()
    .get<boolean>("devtracker.notifications.startup", true);

  if (!enabled) return;

  const last = getLastSessionWindow(ctx);
  if (!last) return; // ✅ silently skip, no popup, no warning

  const lastShown = ctx.globalState.get<string>(KEY_LAST_SHOWN_SESSION);
  if (lastShown === last.endIso) return;

  let snaps: SnapshotSummary[] = [];
  try {
    snaps = await getLatestSnapshots(installationId, 300);
  } catch {
    return;
  }

  const fromT = new Date(last.startIso).getTime();
  const toT = new Date(last.endIso).getTime();

  const inWindow = snaps.filter((s) => {
    const t = new Date(s.created_at).getTime();
    return t >= fromT && t <= toT;
  });

  if (!inWindow.length) return;

  const counts = new Map<string, number>();
  for (const s of inWindow) counts.set(s.file_path, (counts.get(s.file_path) ?? 0) + 1);

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p, n]) => `${fileName(p)} (${n})`)
    .join(", ");

  const msg =
    `DevTracker • Last session: ${inWindow.length} snapshots across ${counts.size} files.` +
    (top ? ` Top: ${top}` : "");

  const OPEN = "Open DevTracker";
  const REVERT = "Bulk Revert…";
  const DISABLE = "Disable popups";

  const picked = await vscode.window.showInformationMessage(msg, OPEN, REVERT, DISABLE);

  if (picked === OPEN) {
    await vscode.commands.executeCommand("devtracker.openHistoryPanel");
  } else if (picked === REVERT) {
    await vscode.commands.executeCommand("devtracker.bulkRevertWizard");
  } else if (picked === DISABLE) {
    await vscode.workspace
      .getConfiguration()
      .update("devtracker.notifications.startup", false, vscode.ConfigurationTarget.Global);
  }

  await ctx.globalState.update(KEY_LAST_SHOWN_SESSION, last.endIso);
}

function fileName(p: string) {
  return p.split(/[/\\]/).pop() || p;
}
