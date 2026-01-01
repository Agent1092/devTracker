"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markSessionStart = markSessionStart;
exports.markSessionEnd = markSessionEnd;
exports.getLastSessionWindow = getLastSessionWindow;
exports.getCurrentSessionStart = getCurrentSessionStart;
const KEY_CURRENT_START = "devtracker.session.currentStart";
const KEY_LAST_WINDOW = "devtracker.session.lastWindow";
const KEY_ENDED_AT = "devtracker.session.lastEndedAt";
/**
 * Start a new session only if one isn't already running.
 * This prevents accidental overwrites on extension host reload.
 */
function markSessionStart(ctx) {
    const existing = ctx.globalState.get(KEY_CURRENT_START);
    if (existing)
        return;
    const nowIso = new Date().toISOString();
    void ctx.globalState.update(KEY_CURRENT_START, nowIso);
}
/**
 * End current session and store it as last window.
 * Debounced by KEY_ENDED_AT to avoid spamming ends.
 */
function markSessionEnd(ctx) {
    const now = Date.now();
    const lastEndedAt = ctx.globalState.get(KEY_ENDED_AT) ?? 0;
    // prevent multiple end writes within 5 seconds
    if (now - lastEndedAt < 5000)
        return;
    const startIso = ctx.globalState.get(KEY_CURRENT_START);
    if (!startIso)
        return;
    const endIso = new Date().toISOString();
    const last = { startIso, endIso };
    void ctx.globalState.update(KEY_LAST_WINDOW, last);
    void ctx.globalState.update(KEY_CURRENT_START, undefined);
    void ctx.globalState.update(KEY_ENDED_AT, now);
}
function getLastSessionWindow(ctx) {
    return ctx.globalState.get(KEY_LAST_WINDOW) ?? null;
}
function getCurrentSessionStart(ctx) {
    return ctx.globalState.get(KEY_CURRENT_START) ?? null;
}
//# sourceMappingURL=session.js.map