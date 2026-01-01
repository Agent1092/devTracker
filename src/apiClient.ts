// src/apiClient.ts

let BACKEND_URL = "http://127.0.0.1:8000"; // default/fallback

export function setBackendUrl(url: string) {
  BACKEND_URL = url;
}

export interface FileChangePayload {
  installation_id: string;
  file_path: string;
  project_root: string | null;
  content: string;
  timestamp: string;
}

export interface SnapshotSummary {
  id: number;
  file_path: string;
  created_at: string;
}

export interface SnapshotDetail extends SnapshotSummary {
  full_text: string;
}

export interface LocalSummaryResponse {
  date: string;
  total_files: number;
  files: { path: string; snapshots: number }[];
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}) ${txt}`);
  }
  return (await res.json()) as T;
}

function urlForRead(path: string) {
  return `${BACKEND_URL}${path}`;
}

export async function pingBackend(): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/system/health`);
  if (!res.ok) throw new Error("Backend not reachable");
  return true;
}

export async function postFileChange(payload: FileChangePayload): Promise<void> {
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

export async function getSnapshot(snapshotId: number): Promise<SnapshotDetail> {
  const res = await fetch(`${BACKEND_URL}/snapshots/${snapshotId}`);
  return parseJson<SnapshotDetail>(res);
}

export async function getLatestSnapshots(
  installationId: string,
  limit = 200
): Promise<SnapshotSummary[]> {
  const url = new URL(`${BACKEND_URL}/snapshots/latest`);
  url.searchParams.set("installation_id", installationId);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString());
  return parseJson<SnapshotSummary[]>(res);
}

export async function getLocalSummaryNew(isoDate: string): Promise<any> {
  // Example: GET /summary/day?date=YYYY-MM-DD
  const res = await fetch(urlForRead(`/summary/day?date=${encodeURIComponent(isoDate)}`));
  if (!res.ok) throw new Error(`Failed summary ${res.status}`);
  return res.json();
}

export async function getRangeSummary(fromIso: string, toIso: string): Promise<any> {
  const qs = new URLSearchParams({ from: fromIso, to: toIso });
  const res = await fetch(urlForRead(`/summary/range?${qs.toString()}`));
  if (!res.ok) throw new Error(`Failed range summary ${res.status}`);
  return res.json();
}


export async function getLocalSummary(
  installationId: string,
  date: Date
): Promise<LocalSummaryResponse> {
  const res = await fetch(`${BACKEND_URL}/summary/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installation_id: installationId,
      date: date.toISOString(),
    }),
  });

  return parseJson<LocalSummaryResponse>(res);
}
