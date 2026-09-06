/**
 * Single source of truth for the portfolio.
 * Server-first: reads/writes portfolio state via /api/state
 * and uploads media via /api/upload.
 *
 * Falls back to localStorage + IndexedDB when the API is unreachable
 * (e.g. opening index.html directly from disk).
 */

import { buildSeed } from "./seed.js";

export const STORAGE_KEY = "ppd-portfolio-para-gallery-v1";
export const SESSION_KEY = "ppd-session";
export const IDB_NAME = "ppd-media";
export const IDB_STORE = "files";
export const CHANGE_EVENT = "ppd-change";

const objectUrls = new Map();
let memoryState = null;
let dbPromise = null;
let saveTimer = null;
let apiSupported = true;

/* ── Utilities ──────────────────────────────────────────────────────── */

export function uid(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function notify() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/* ── API persistence (debounced) ────────────────────────────────────── */

function persistToApi(state) {
  if (!apiSupported) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (res.status === 404) {
        apiSupported = false;
      }
    } catch (e) {
      apiSupported = false;
      console.warn("[store] Server sync paused (API unreachable)");
    }
  }, 300);
}

/* ── State persistence ──────────────────────────────────────────────── */

function persist(state) {
  memoryState = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded or private mode */ }
  persistToApi(state);
  notify();
}

export function persistState(state = getState()) {
  persist(state);
}

export function getState() {
  if (memoryState) return memoryState;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    memoryState = JSON.parse(raw);
    return memoryState;
  } catch {
    return null;
  }
}

export async function initStore() {
  // 1. Try the server API first (shared across all visitors)
  if (apiSupported) {
    try {
      const res = await fetch("/api/state");
      if (res.status === 404) {
        apiSupported = false;
      } else if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.projects) && data.projects.length > 0) {
          memoryState = data;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
          await openDb().catch(() => {});
          return data;
        }
      }
    } catch {
      apiSupported = false;
      console.warn("[store] API not available, using local data");
    }
  }

  // 2. Fall back to localStorage / seed
  let state = getState();
  if (!state || !Array.isArray(state.projects) || state.projects.length === 0) {
    state = buildSeed();
  }
  persist(state);
  memoryState = state;
  await openDb().catch(() => {});
  return state;
}

export async function resetSeed() {
  // Clear server data
  try { await fetch("/api/reset", { method: "POST" }); } catch {}
  // Clear local IDB
  const ids = await listMediaIdsLocal().catch(() => []);
  await Promise.all(ids.map((id) => deleteMediaLocal(id)));
  // Rebuild seed
  const state = buildSeed();
  persist(state);
  return state;
}

/* ── Settings ───────────────────────────────────────────────────────── */

export function getSettings() {
  return getState().settings;
}

export function updateSettings(partial) {
  const state = getState();
  state.settings = { ...state.settings, ...partial };
  persist(state);
  return state.settings;
}

/* ── Categories ─────────────────────────────────────────────────────── */

export function getCategories() {
  return getState().categories;
}

export function getCategory(idOrSlug) {
  return getCategories().find((c) => c.id === idOrSlug || c.slug === idOrSlug);
}

/* ── Projects ───────────────────────────────────────────────────────── */

export function getProjects({ publishedOnly = false, categoryId = null } = {}) {
  let list = [...getState().projects];
  if (publishedOnly) list = list.filter((p) => p.status === "published");
  if (categoryId) list = list.filter((p) => p.categoryId === categoryId);
  return list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getProject(id) {
  return getState().projects.find((p) => p.id === id) || null;
}

export function saveProject(project) {
  const state = getState();
  const idx = state.projects.findIndex((p) => p.id === project.id);
  const record = {
    ...project,
    updatedAt: nowIso(),
    createdAt: project.createdAt || nowIso(),
    imageIds: project.imageIds || [],
  };
  if (idx >= 0) state.projects[idx] = record;
  else state.projects.push(record);
  persist(state);
  return record;
}

export function deleteProject(id) {
  const state = getState();
  const project = state.projects.find((p) => p.id === id);
  state.projects = state.projects.filter((p) => p.id !== id);
  persist(state);
  return project;
}

export function countByCategory() {
  const counts = {};
  for (const c of getCategories()) counts[c.id] = 0;
  for (const p of getState().projects) {
    if (counts[p.categoryId] == null) counts[p.categoryId] = 0;
    counts[p.categoryId] += 1;
  }
  return counts;
}

/* ── IndexedDB (local fallback for media) ───────────────────────────── */

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function txStore(storeName, mode) {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

async function putMediaLocal({ id, mime, blob, name }) {
  const store = await txStore(IDB_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const rec = { id, mime, blob, name };
    const req = store.put(rec);
    req.onsuccess = () => resolve(rec);
    req.onerror = () => reject(req.error);
  });
}

async function getMediaLocal(id) {
  const store = await txStore(IDB_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteMediaLocal(id) {
  revokeCached(id);
  const store = await txStore(IDB_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function listMediaLocal() {
  const store = await txStore(IDB_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function listMediaIdsLocal() {
  const all = await listMediaLocal().catch(() => []);
  return all.map((r) => r.id);
}

/* ── Public media API (server-first, IDB fallback) ──────────────────── */

// Keep old putMedia/getMedia/deleteMedia names for backwards compat
export const putMedia = putMediaLocal;
export const getMedia = getMediaLocal;

export async function deleteMedia(id, source = "server") {
  if (source === "server") {
    try {
      await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("[store] Failed to delete from server:", e);
    }
  } else {
    await deleteMediaLocal(id);
  }
}

export async function listMedia() {
  const results = [];
  // Server uploads
  try {
    const res = await fetch("/api/media");
    if (res.ok) {
      const files = await res.json();
      results.push(...files.map((f) => ({ ...f, source: "server" })));
    }
  } catch {
    // Server not available
  }
  // Local IDB (fallback / legacy)
  try {
    const idbFiles = await listMediaLocal();
    results.push(...idbFiles.map((f) => ({ ...f, source: "idb" })));
  } catch {
    // IDB not available
  }
  return results;
}

/* ── Ref helpers ────────────────────────────────────────────────────── */

export function staticRef(filename) {
  return `static:${filename}`;
}

export function idbRef(id) {
  return `idb:${id}`;
}

export function uploadRef(filename) {
  return `upload:${filename}`;
}

export function isStaticRef(ref) {
  return typeof ref === "string" && ref.startsWith("static:");
}

export function isIdbRef(ref) {
  return typeof ref === "string" && ref.startsWith("idb:");
}

export function isUploadRef(ref) {
  return typeof ref === "string" && ref.startsWith("upload:");
}

export function refId(ref) {
  if (isIdbRef(ref)) return ref.slice(4);
  if (isStaticRef(ref)) return ref.slice(7);
  if (isUploadRef(ref)) return ref.slice(7);
  return ref;
}

export function staticPath(filename) {
  return `/assets/images/${filename}`;
}

function revokeCached(id) {
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

export async function resolveSrc(ref) {
  if (!ref) return "";
  if (isStaticRef(ref)) return staticPath(ref.slice(7));
  // Server uploads → simple URL path
  if (isUploadRef(ref)) return `/api/media/${encodeURIComponent(ref.slice(7))}`;
  // Legacy IDB refs → object URL from IndexedDB blob
  if (isIdbRef(ref)) {
    const id = ref.slice(4);
    if (objectUrls.has(id)) return objectUrls.get(id);
    const rec = await getMediaLocal(id).catch(() => null);
    if (!rec) return "";
    const url = URL.createObjectURL(rec.blob);
    objectUrls.set(id, url);
    return url;
  }
  if (ref.startsWith("/assets/") || ref.startsWith("http")) return ref;
  return staticPath(ref);
}

/* ── Image compression ──────────────────────────────────────────────── */

export function compressImage(file, maxEdge = 2400, quality = 0.85) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return Promise.resolve(file);
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const mime = file.type === "image/png" && scale === 1 ? "image/png" : "image/jpeg";
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            resolve(file);
            return;
          }
          const name =
            mime === "image/jpeg" ? file.name.replace(/\.\w+$/, ".jpg") : file.name;
          resolve(new File([blob], name, { type: mime }));
        },
        mime,
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/* ── File uploads (server-first, IDB fallback) ──────────────────────── */

export async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  const refs = [];
  for (const raw of files) {
    const file = raw.type.startsWith("image/") ? await compressImage(raw) : raw;
    // Try server upload first
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        refs.push(uploadRef(data.filename));
        continue;
      }
    } catch {
      console.warn("[store] Server upload failed, using IndexedDB fallback");
    }
    // Fallback: store in IndexedDB
    const id = uid("media");
    await putMediaLocal({
      id,
      mime: file.type || "application/octet-stream",
      blob: file,
      name: file.name || id,
    });
    refs.push(idbRef(id));
  }
  notify();
  return refs;
}

/* ── Ref analysis ───────────────────────────────────────────────────── */

export function mediaUsage() {
  const used = new Map();
  const add = (ref, project) => {
    if (!ref) return;
    if (!used.has(ref)) used.set(ref, []);
    used.get(ref).push(project);
  };
  for (const p of getState().projects) {
    add(p.coverImageId, p);
    for (const ref of p.imageIds || []) add(ref, p);
    add(p.videoFileId, p);
  }
  return used;
}

export function collectAllRefs() {
  const refs = new Set();
  for (const p of getState().projects) {
    if (p.coverImageId) refs.add(p.coverImageId);
    for (const r of p.imageIds || []) refs.add(r);
    if (p.videoFileId) refs.add(p.videoFileId);
  }
  return [...refs];
}

/* ── Cross-tab sync ─────────────────────────────────────────────────── */

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    memoryState = null;
    getState();
    notify();
  }
});
