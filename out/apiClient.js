"use strict";
// src/apiClient.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.setBackendUrl = setBackendUrl;
exports.pingBackend = pingBackend;
exports.postFileChange = postFileChange;
exports.getSnapshot = getSnapshot;
exports.getLatestSnapshots = getLatestSnapshots;
exports.getLocalSummary = getLocalSummary;
let BACKEND_URL = "http://127.0.0.1:8000"; // default/fallback
function setBackendUrl(url) {
    BACKEND_URL = url;
}
async function parseJson(res) {
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Request failed (${res.status}) ${txt}`);
    }
    return (await res.json());
}
async function pingBackend() {
    const res = await fetch(`${BACKEND_URL}/system/health`);
    if (!res.ok)
        throw new Error("Backend not reachable");
    return true;
}
async function postFileChange(payload) {
    const res = await fetch(`${BACKEND_URL}/events/file-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to post file change (${res.status}) ${txt}`);
    }
}
async function getSnapshot(snapshotId) {
    const res = await fetch(`${BACKEND_URL}/snapshots/${snapshotId}`);
    return parseJson(res);
}
async function getLatestSnapshots(installationId, limit = 200) {
    const url = new URL(`${BACKEND_URL}/snapshots/latest`);
    url.searchParams.set("installation_id", installationId);
    url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString());
    return parseJson(res);
}
async function getLocalSummary(installationId, date) {
    const res = await fetch(`${BACKEND_URL}/summary/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            installation_id: installationId,
            date: date.toISOString(),
        }),
    });
    return parseJson(res);
}
//# sourceMappingURL=apiClient.js.map