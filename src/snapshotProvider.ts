import * as vscode from "vscode";
import { getSnapshot } from "./apiClient";

export class SnapshotContentProvider
  implements vscode.TextDocumentContentProvider
{
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const snapshotId = Number(uri.path.replace("/", ""));

    if (Number.isNaN(snapshotId)) return "Invalid snapshot id";

    try {
      const snap = await getSnapshot(snapshotId);
      return snap.full_text;
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `DevTracker: failed to load snapshot ${snapshotId}: ${err?.message ?? err}`
      );
      return "Unable to load snapshot content.";
    }
  }
}

export function registerSnapshotProvider(context: vscode.ExtensionContext) {
  const provider = new SnapshotContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "devtracker-snapshot",
      provider
    )
  );
}
