type Activity = "loading" | "saving" | "uploading";
const pending = new Map<symbol, Activity>();
const listeners = new Set<() => void>();
let snapshot = { total: 0, loading: 0, saving: 0, uploading: 0 };

export function getActivity() { return snapshot; }
export function subscribeActivity(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish() {
  snapshot = { total: pending.size, loading: 0, saving: 0, uploading: 0 };
  for (const kind of pending.values()) snapshot[kind]++;
  for (const listener of listeners) listener();
}
export const trackedFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
  const url = request?.url ?? String(input);
  const isUpload = ["POST", "PUT", "PATCH"].includes(method) &&
    /\/storage\/v1\/object\//.test(url) && !/\/object\/(sign|list)\//.test(url);
  const kind: Activity = isUpload ? "uploading" : ["GET", "HEAD"].includes(method) ? "loading" : "saving";
  const id = Symbol();
  pending.set(id, kind);
  publish();
  try {
    return await globalThis.fetch(input, init);
  } finally {
    pending.delete(id);
    publish();
  }
};
