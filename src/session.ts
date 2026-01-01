// src/session.ts
import * as vscode from "vscode";

export type SessionWindow = { startIso: string; endIso: string };

const KEY_CURRENT_START = "devtracker.session.currentStart";
const KEY_LAST_WINDOW = "devtracker.session.lastWindow";
const KEY_ENDED_AT = "devtracker.session.lastEndedAt";

/**
 * Start a new session only if one isn't already running.
 * This prevents accidental overwrites on extension host reload.
 */
export function markSessionStart(ctx: vscode.ExtensionContext) {
  const existing = ctx.globalState.get<string>(KEY_CURRENT_START);
  if (existing) return;

  const nowIso = new Date().toISOString();
  void ctx.globalState.update(KEY_CURRENT_START, nowIso);
}

/**
 * End current session and store it as last window.
 * Debounced by KEY_ENDED_AT to avoid spamming ends.
 */
export function markSessionEnd(ctx: vscode.ExtensionContext) {
  const now = Date.now();
  const lastEndedAt = ctx.globalState.get<number>(KEY_ENDED_AT) ?? 0;

  // prevent multiple end writes within 5 seconds
  if (now - lastEndedAt < 5000) return;

  const startIso = ctx.globalState.get<string>(KEY_CURRENT_START);
  if (!startIso) return;

  const endIso = new Date().toISOString();
  const last: SessionWindow = { startIso, endIso };

  void ctx.globalState.update(KEY_LAST_WINDOW, last);
  void ctx.globalState.update(KEY_CURRENT_START, undefined);
  void ctx.globalState.update(KEY_ENDED_AT, now);
}

export function getLastSessionWindow(ctx: vscode.ExtensionContext): SessionWindow | null {
  return (ctx.globalState.get<SessionWindow>(KEY_LAST_WINDOW) as SessionWindow | undefined) ?? null;
}

export function getCurrentSessionStart(ctx: vscode.ExtensionContext): string | null {
  return ctx.globalState.get<string>(KEY_CURRENT_START) ?? null;
}
