/**
 * Single source of truth for the portfolio prototype.
 * localStorage: ppd-portfolio  |  IndexedDB: ppd-media
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

export function uid(prefix = "id") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function notify() {
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function persist(state) {
  memoryState = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  let state = getState();
  if (!state || !Array.isArray(state.projects) || state.projects.length === 0) {
    state = buildSeed();
    persist(state);
  }
  memoryState = state;
  await openDb();
  return state;
}

export async function resetSeed() {
  const ids = await listMediaIds();
  await Promise.all(ids.map((id) => deleteMedia(id)));
  const state = buildSeed();
  persist(state);
  return state;
}

export function getSettings() {
  return getState().settings;
}

export function getCategories() {
  return getState().categories;
}

export function getCategory(idOrSlug) {
  return getCategories().find((c) => c.id === idOrSlug || c.slug === idOrSlug);
}

export function updateSettings(partial) {
  const state = getState();
  state.settings = { ...state.settings, ...partial };
  persist(state);
  return state.settings;
}

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

function tx(storeName, mode) {
  return openDb().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export async function putMedia({ id, mime, blob, name }) {
  const store = await tx(IDB_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const rec = { id, mime, blob, name };
    const req = store.put(rec);
    req.onsuccess = () => resolve(rec);
    req.onerror = () => reject(req.error);
  });
}

export async function getMedia(id) {
  const store = await tx(IDB_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMedia(id) {
  revokeCached(id);
  const store = await tx(IDB_STORE, "readwrite");
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listMedia() {
  const store = await tx(IDB_STORE, "readonly");
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function listMediaIds() {
  const all = await listMedia().catch(() => []);
  return all.map((r) => r.id);
}

export function staticRef(filename) {
  return `static:${filename}`;
}

export function idbRef(id) {
  return `idb:${id}`;
}

export function isStaticRef(ref) {
  return typeof ref === "string" && ref.startsWith("static:");
}

export function isIdbRef(ref) {
  return typeof ref === "string" && ref.startsWith("idb:");
}

export function refId(ref) {
  if (isIdbRef(ref)) return ref.slice(4);
  if (isStaticRef(ref)) return ref.slice(7);
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
  if (isIdbRef(ref)) {
    const id = ref.slice(4);
    if (objectUrls.has(id)) return objectUrls.get(id);
    const rec = await getMedia(id);
    if (!rec) return "";
    const url = URL.createObjectURL(rec.blob);
    objectUrls.set(id, url);
    return url;
  }
  if (ref.startsWith("/assets/") || ref.startsWith("http")) return ref;
  return staticPath(ref);
}

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

export async function uploadFiles(fileList) {
  const files = Array.from(fileList || []);
  const refs = [];
  for (const raw of files) {
    const file = raw.type.startsWith("image/") ? await compressImage(raw) : raw;
    const id = uid("media");
    await putMedia({
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

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    memoryState = null;
    getState();
    notify();
  }
});
