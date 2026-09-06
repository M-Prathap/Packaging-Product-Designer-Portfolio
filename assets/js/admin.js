import {
  initStore,
  getState,
  getSettings,
  updateSettings,
  getCategories,
  getCategory,
  getProjects,
  getProject,
  saveProject,
  deleteProject,
  countByCategory,
  uploadFiles,
  resolveSrc,
  listMedia,
  deleteMedia,
  mediaUsage,
  resetSeed,
  persistState,
  uid,
  nowIso,
  SESSION_KEY,
} from "./store.js";

const root = document.getElementById("root");
let previewRef = null;
let confirmState = null;

function isAuthed() {
  return sessionStorage.getItem(SESSION_KEY) === "ok";
}

function login(password) {
  const expected = getSettings().password || "atelier";
  if (password !== expected) return false;
  sessionStorage.setItem(SESSION_KEY, "ok");
  return true;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  render();
}

function route() {
  const raw = (location.hash || "#/dashboard").replace(/^#/, "") || "/dashboard";
  const path = raw.split("?")[0];
  const parts = path.split("/").filter(Boolean);
  return { view: parts[0] || "dashboard", id: parts[1] || "" };
}

function go(hash) {
  location.hash = hash.startsWith("#") ? hash : `#${hash}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

async function src(ref) {
  return resolveSrc(ref);
}

function shell(title, body, { active } = {}) {
  const nav = [
    ["dashboard", "Dashboard"],
    ["projects", "Projects"],
    ["categories", "Categories"],
    ["media", "Media"],
    ["settings", "Settings"],
  ]
    .map(
      ([id, label]) =>
        `<button class="navbtn ${active === id ? "is-active" : ""}" data-go="#/${id}">${label}</button>`
    )
    .join("");

  return `
    <div class="admin">
      <aside class="sidebar">
        <div class="brand">Portfolio CMS</div>
        ${nav}
        <div class="spacer"></div>
        <button class="navbtn" data-logout>Log out</button>
      </aside>
      <div>
        <div class="topbar">
          <h1>${escapeHtml(title)}</h1>
          <button class="btn" data-go="#/projects/new" ${active === "projects" ? "" : 'style="visibility:hidden"'}>Add project</button>
        </div>
        <div class="main">${body}</div>
      </div>
    </div>
    <div id="modal-host"></div>
    <div id="preview-host"></div>`;
}

function bindChrome() {
  root.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", () => go(el.getAttribute("data-go")));
  });
  root.querySelector("[data-logout]")?.addEventListener("click", logout);
}

async function renderLogin() {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form">
        <h1>Studio manager</h1>
        <p class="note">Prototype lock only — this is not real security. Default password is set in Settings. Closing the tab logs you out.</p>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <p class="login-error" id="login-error"></p>
        <button class="btn btn-primary" type="submit">Enter</button>
      </form>
    </div>`;
  document.getElementById("login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = new FormData(e.target).get("password");
    if (login(String(pw))) render();
    else document.getElementById("login-error").textContent = "Incorrect password.";
  });
  document.getElementById("password").focus();
}

async function renderDashboard() {
  const all = getProjects();
  const counts = countByCategory();
  const pack = counts["cat-packaging"] || 0;
  const brand = counts["cat-logo"] || 0;
  const vids = counts["cat-videos"] || 0;
  const recent = [...all].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6);
  const rows = await Promise.all(
    recent.map(async (p) => {
      const url = await src(p.coverImageId);
      return `
        <a class="recent-item" href="#/projects/${p.id}">
          ${url ? `<img src="${url}" alt="" />` : `<span></span>`}
          <div>
            <strong>${escapeHtml(p.title)}</strong>
            <div class="muted">${escapeHtml(getCategory(p.categoryId)?.name || "")} · ${escapeHtml(p.year)}</div>
          </div>
          <span class="badge ${p.status}">${p.status}</span>
        </a>`;
    })
  );
  root.innerHTML = shell(
    "Dashboard",
    `
    <div class="stats">
      <div class="stat"><b>${all.length}</b><span>Total projects</span></div>
      <div class="stat"><b>${pack}</b><span>Packaging projects</span></div>
      <div class="stat"><b>${brand}</b><span>Branding projects</span></div>
      <div class="stat"><b>${vids}</b><span>Videos</span></div>
    </div>
    <div class="panel">
      <h2>Recently added</h2>
      ${rows.join("") || `<p class="muted" style="padding:1rem">No projects yet.</p>`}
    </div>`,
    { active: "dashboard" }
  );
  bindChrome();
}

async function renderProjects() {
  const filter = new URLSearchParams(location.hash.split("?")[1] || "").get("cat") || "";
  const cats = getCategories();
  let list = getProjects();
  if (filter) list = list.filter((p) => p.categoryId === filter);
  const options = [`<option value="">All categories</option>`]
    .concat(cats.map((c) => `<option value="${c.id}" ${filter === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`))
    .join("");
  const rows = await Promise.all(
    list.map(async (p, idx) => {
      const url = await src(p.coverImageId);
      const sizeLabel = p.gridSize === "wide" ? "Wide (2 cols)" : p.gridSize === "tall" ? "Tall (2 rows)" : p.gridSize === "item" ? "Standard (1x1)" : "Auto";
      return `<tr>
        <td>${url ? `<img class="thumb" src="${url}" alt="" />` : ""}</td>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.client)}</td>
        <td>${escapeHtml(getCategory(p.categoryId)?.name || "")}</td>
        <td>${escapeHtml(p.year)}</td>
        <td><span class="badge" style="background:rgba(255,255,255,0.06);color:var(--accent-bright);">${sizeLabel}</span></td>
        <td>${p.order}</td>
        <td><span class="badge ${p.status}">${p.status}</span></td>
        <td class="actions">
          <button class="btn" data-go="#/projects/${p.id}">Edit</button>
          <button class="btn btn-danger" data-del="${p.id}">Delete</button>
        </td>
      </tr>`;
    })
  );
  root.innerHTML = shell(
    "Projects",
    `
    <div class="toolbar">
      <label class="field" style="min-width:200px">Filter
        <select id="cat-filter">${options}</select>
      </label>
      <button class="btn btn-primary" data-go="#/projects/new">Add project</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th><th>Title</th><th>Client</th><th>Category</th><th>Year</th><th>Grid Size</th><th>Order</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>${rows.join("") || `<tr><td colspan="9">No projects.</td></tr>`}</tbody>
      </table>
    </div>`,
    { active: "projects" }
  );
  bindChrome();
  document.getElementById("cat-filter").addEventListener("change", (e) => {
    const v = e.target.value;
    location.hash = v ? `#/projects?cat=${v}` : "#/projects";
  });
  root.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => openConfirm(btn.getAttribute("data-del")));
  });
}

function openConfirm(id) {
  confirmState = id;
  const host = document.getElementById("modal-host");
  const p = getProject(id);
  host.innerHTML = `
    <div class="modal-back" id="confirm-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h3 id="confirm-title">Delete project?</h3>
        <p>This removes “${escapeHtml(p?.title || "")}” from the portfolio. Images in the media library are kept unless you delete them separately.</p>
        <div class="btn-row">
          <button class="btn btn-danger" id="confirm-yes">Delete</button>
          <button class="btn" id="confirm-no">Cancel</button>
        </div>
      </div>
    </div>`;
  const modal = document.getElementById("confirm-modal");
  const yes = document.getElementById("confirm-yes");
  const no = document.getElementById("confirm-no");
  yes.focus();
  const trap = (e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      (document.activeElement === yes ? no : yes).focus();
    }
  };
  const close = () => {
    document.removeEventListener("keydown", trap);
    host.innerHTML = "";
    confirmState = null;
  };
  no.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  yes.addEventListener("click", () => {
    deleteProject(id);
    close();
    go("#/projects");
    render();
  });
  document.addEventListener("keydown", trap);
}

function emptyProject() {
  const maxOrder = Math.max(0, ...getProjects().map((p) => Number(p.order) || 0));
  return {
    id: uid("proj"),
    title: "",
    client: "",
    categoryId: getCategories()[0].id,
    year: String(new Date().getFullYear()),
    gridSize: "auto",
    description: "",
    overview: "",
    challenge: "",
    concept: "",
    process: "",
    status: "draft",
    order: maxOrder + 1,
    coverImageId: "",
    imageIds: [],
    videoUrl: "",
    videoFileId: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

async function thumbCard(ref, project) {
  const url = await src(ref);
  const isCover = project.coverImageId === ref;
  const isVideo = /\.(mp4|webm|mov)$/i.test(ref) || (url && url.includes("video"));
  const media = url
    ? isVideo
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="" />`
    : `<div class="muted">Missing</div>`;
  return `
    <div class="thumb-card" draggable="true" data-ref="${escapeAttr(ref)}">
      ${media}
      ${isCover ? `<div class="cover-tag">Cover</div>` : ""}
      <div class="row">
        <button type="button" data-preview="${escapeAttr(ref)}">Preview</button>
        <button type="button" data-cover="${escapeAttr(ref)}">Set cover</button>
        <button type="button" data-replace="${escapeAttr(ref)}">Replace</button>
        <button type="button" data-remove="${escapeAttr(ref)}">Delete</button>
      </div>
    </div>`;
}

async function renderEditor(id) {
  const isNew = id === "new";
  const project = isNew ? emptyProject() : getProject(id);
  if (!project) {
    root.innerHTML = shell("Missing", `<p>Project not found.</p>`, { active: "projects" });
    bindChrome();
    return;
  }
  const catOpts = getCategories()
    .map((c) => `<option value="${c.id}" ${c.id === project.categoryId ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
  const thumbs = (await Promise.all((project.imageIds || []).map((r) => thumbCard(r, project)))).join("");
  const videoSrc = project.videoFileId ? await src(project.videoFileId) : "";

  root.innerHTML = shell(
    isNew ? "New project" : "Edit project",
    `
    <form id="project-form" class="form-grid two">
      <label class="field">Project title
        <input name="title" type="text" required value="${escapeAttr(project.title)}" />
      </label>
      <label class="field">Client / Brand
        <input name="client" type="text" value="${escapeAttr(project.client)}" />
      </label>
      <label class="field">Category
        <select name="categoryId">${catOpts}</select>
      </label>
      <label class="field">Year
        <input name="year" type="text" value="${escapeAttr(project.year)}" />
      </label>
      <label class="field">Status
        <select name="status">
          <option value="draft" ${project.status === "draft" ? "selected" : ""}>Draft</option>
          <option value="published" ${project.status === "published" ? "selected" : ""}>Published</option>
        </select>
      </label>
      <label class="field">Display order
        <input name="order" type="number" value="${escapeAttr(project.order)}" />
      </label>
      <label class="field full">Grid Layout Size (Website Masonry)
        <select name="gridSize">
          <option value="auto" ${project.gridSize === "auto" || !project.gridSize ? "selected" : ""}>Auto (Pattern: Standard / Wide / Tall)</option>
          <option value="item" ${project.gridSize === "item" ? "selected" : ""}>Standard (1x1 square)</option>
          <option value="wide" ${project.gridSize === "wide" ? "selected" : ""}>Wide (Spans 2 columns horizontal)</option>
          <option value="tall" ${project.gridSize === "tall" ? "selected" : ""}>Tall (Spans 2 rows vertical)</option>
        </select>
      </label>
      <label class="field full">Short description
        <textarea name="description">${escapeHtml(project.description)}</textarea>
      </label>
      <label class="field full">Overview
        <textarea name="overview">${escapeHtml(project.overview)}</textarea>
      </label>
      <label class="field full">Design challenge
        <textarea name="challenge">${escapeHtml(project.challenge)}</textarea>
      </label>
      <label class="field full">Concept
        <textarea name="concept">${escapeHtml(project.concept)}</textarea>
      </label>
      <label class="field full">Design process
        <textarea name="process">${escapeHtml(project.process)}</textarea>
      </label>
      <label class="field full">Video URL (YouTube or Vimeo)
        <input name="videoUrl" type="url" value="${escapeAttr(project.videoUrl)}" placeholder="https://" />
      </label>
      <div class="field full">
        <span>Cover & project images</span>
        <div class="dropzone" id="dropzone">Drop images here or click to upload</div>
        <input id="file-input" type="file" accept="image/*" multiple hidden />
        <input id="replace-input" type="file" accept="image/*" hidden />
        <div class="thumbs" id="thumbs">${thumbs}</div>
      </div>
      <div class="field full">
        <span>Video file</span>
        <input id="video-input" type="file" accept="video/*" />
        ${videoSrc ? `<video src="${videoSrc}" controls style="max-width:320px;margin-top:.6rem"></video>` : ""}
        ${project.videoFileId ? `<div><button type="button" class="btn" id="clear-video">Remove uploaded video</button></div>` : ""}
      </div>
      <div class="btn-row full">
        <button class="btn btn-primary" type="submit">Save</button>
        <button class="btn" type="button" data-go="#/projects">Cancel</button>
      </div>
    </form>`,
    { active: "projects" }
  );
  bindChrome();

  const form = document.getElementById("project-form");
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const replaceInput = document.getElementById("replace-input");
  const thumbsEl = document.getElementById("thumbs");
  let replaceTarget = null;

  function readForm() {
    const fd = new FormData(form);
    return {
      ...project,
      title: String(fd.get("title") || "").trim(),
      client: String(fd.get("client") || "").trim(),
      categoryId: String(fd.get("categoryId")),
      year: String(fd.get("year") || "").trim(),
      status: String(fd.get("status")),
      order: Number(fd.get("order")) || 0,
      gridSize: String(fd.get("gridSize") || "auto"),
      description: String(fd.get("description") || ""),
      overview: String(fd.get("overview") || ""),
      challenge: String(fd.get("challenge") || ""),
      concept: String(fd.get("concept") || ""),
      process: String(fd.get("process") || ""),
      videoUrl: String(fd.get("videoUrl") || "").trim(),
    };
  }

  async function refreshThumbs() {
    thumbsEl.innerHTML = (await Promise.all((project.imageIds || []).map((r) => thumbCard(r, project)))).join("");
    bindThumbs();
  }

  function bindThumbs() {
    thumbsEl.querySelectorAll(".thumb-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        card.classList.add("is-dragging");
        e.dataTransfer.setData("text/plain", card.dataset.ref);
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
      card.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData("text/plain");
        const to = card.dataset.ref;
        if (!from || from === to) return;
        const ids = [...project.imageIds];
        const fi = ids.indexOf(from);
        const ti = ids.indexOf(to);
        if (fi < 0 || ti < 0) return;
        ids.splice(fi, 1);
        ids.splice(ti, 0, from);
        project.imageIds = ids;
        refreshThumbs();
      });
    });
    thumbsEl.querySelectorAll("[data-preview]").forEach((b) =>
      b.addEventListener("click", () => openPreview(b.getAttribute("data-preview")))
    );
    thumbsEl.querySelectorAll("[data-cover]").forEach((b) =>
      b.addEventListener("click", () => {
        project.coverImageId = b.getAttribute("data-cover");
        refreshThumbs();
      })
    );
    thumbsEl.querySelectorAll("[data-remove]").forEach((b) =>
      b.addEventListener("click", () => {
        const ref = b.getAttribute("data-remove");
        project.imageIds = project.imageIds.filter((r) => r !== ref);
        if (project.coverImageId === ref) project.coverImageId = project.imageIds[0] || "";
        refreshThumbs();
      })
    );
    thumbsEl.querySelectorAll("[data-replace]").forEach((b) =>
      b.addEventListener("click", () => {
        replaceTarget = b.getAttribute("data-replace");
        replaceInput.click();
      })
    );
  }

  bindThumbs();

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("is-over");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));
  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-over");
    await addFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", async () => {
    await addFiles(fileInput.files);
    fileInput.value = "";
  });
  replaceInput.addEventListener("change", async () => {
    if (!replaceTarget || !replaceInput.files?.length) return;
    const refs = await uploadFiles(replaceInput.files);
    const next = refs[0];
    project.imageIds = project.imageIds.map((r) => (r === replaceTarget ? next : r));
    if (project.coverImageId === replaceTarget) project.coverImageId = next;
    replaceTarget = null;
    replaceInput.value = "";
    await refreshThumbs();
  });

  async function addFiles(files) {
    if (!files?.length) return;
    const refs = await uploadFiles(files);
    project.imageIds = [...(project.imageIds || []), ...refs];
    if (!project.coverImageId) project.coverImageId = refs[0];
    await refreshThumbs();
  }

  document.getElementById("video-input")?.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const input = e.target;
    input.disabled = true;
    const statusSpan = document.createElement("span");
    statusSpan.style.cssText = "margin-left:0.5rem;color:var(--accent);font-size:0.8rem;font-weight:500;";
    statusSpan.textContent = "Uploading video... Please wait.";
    input.parentNode.appendChild(statusSpan);

    try {
      const refs = await uploadFiles(files);
      if (refs?.length) {
        project.videoFileId = refs[0];
        Object.assign(project, readForm());
        saveProject(project);
        await renderEditor(project.id);
      }
    } catch (err) {
      alert("Video upload failed: " + (err.message || "Unknown error"));
      statusSpan.remove();
      input.disabled = false;
    }
  });
  document.getElementById("clear-video")?.addEventListener("click", async () => {
    project.videoFileId = "";
    Object.assign(project, readForm());
    saveProject(project);
    await renderEditor(project.id);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = readForm();
    if (!data.title) return;
    saveProject(data);
    go("#/projects");
    render();
  });
}

async function openPreview(ref) {
  previewRef = ref;
  const url = await src(ref);
  const host = document.getElementById("preview-host");
  host.innerHTML = `
    <div class="preview-back" id="preview-back" role="dialog" aria-modal="true">
      ${url ? `<img src="${url}" alt="Preview" />` : `<p>Cannot preview</p>`}
    </div>`;
  const back = document.getElementById("preview-back");
  const close = () => {
    host.innerHTML = "";
    previewRef = null;
  };
  back.addEventListener("click", close);
  const onKey = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
}

async function renderCategories() {
  const counts = countByCategory();
  const rows = getCategories()
    .map(
      (c) => `
      <div class="cat-row">
        <div>
          <strong>${escapeHtml(c.name)}</strong>
          <div class="muted">${escapeHtml(c.slug)}</div>
        </div>
        <div>${counts[c.id] || 0} projects</div>
      </div>`
    )
    .join("");
  root.innerHTML = shell(
    "Categories",
    `<p class="muted">Fixed set for this prototype. Assign each project to exactly one.</p>
     <div class="cat-list">${rows}</div>`,
    { active: "categories" }
  );
  bindChrome();
}

async function renderMedia() {
  const usage = mediaUsage();
  const allMedia = await listMedia();
  const staticSeen = new Set();
  const cards = [];

  for (const rec of allMedia) {
    const ref = rec.source === "server" ? `upload:${rec.id}` : `idb:${rec.id}`;
    const url = await src(ref);
    const used = usage.get(ref) || [];
    const names = used.map((p) => p.title).join(", ") || "Unassigned";
    const label = rec.source === "server" ? "server" : "browser";
    cards.push(`
      <div class="media-card">
        ${url ? `<img src="${url}" alt="${escapeAttr(rec.name)}" />` : ""}
        <div class="muted">${escapeHtml(rec.name)} (${label})</div>
        <div>${escapeHtml(names)}</div>
        <button class="btn btn-danger" data-media-del="${rec.id}" data-media-source="${rec.source}">Delete file</button>
      </div>`);
  }

  for (const [ref, projects] of usage.entries()) {
    if (!ref.startsWith("static:")) continue;
    if (staticSeen.has(ref)) continue;
    staticSeen.add(ref);
    const url = await src(ref);
    cards.push(`
      <div class="media-card">
        ${url ? `<img src="${url}" alt="" />` : ""}
        <div class="muted">${escapeHtml(ref.slice(7))} (seed)</div>
        <div>${escapeHtml(projects.map((p) => p.title).join(", "))}</div>
      </div>`);
  }

  root.innerHTML = shell(
    "Media",
    `<p class="muted">Uploaded files are stored on the server. Seed photographs are static files in assets/images.</p>
     <div class="media-grid">${cards.join("") || "<p>No media yet.</p>"}</div>`,
    { active: "media" }
  );
  bindChrome();
  root.querySelectorAll("[data-media-del]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-media-del");
      const source = b.getAttribute("data-media-source") || "server";
      const ref = source === "server" ? `upload:${id}` : `idb:${id}`;
      const state = getState();
      for (const p of state.projects) {
        if (p.coverImageId === ref) p.coverImageId = "";
        p.imageIds = (p.imageIds || []).filter((r) => r !== ref);
        if (p.videoFileId === ref) p.videoFileId = "";
      }
      persistState(state);
      await deleteMedia(id, source);
      render();
    });
  });
}

async function renderSettings() {
  const s = getSettings();
  root.innerHTML = shell(
    "Settings",
    `<p class="muted">Data is saved on the server and visible to all visitors. Public pages read these fields on load.</p>
    <form id="settings-form" class="form-grid two">
      <label class="field">Designer name
        <input name="name" type="text" required value="${escapeAttr(s.name)}" />
      </label>
      <label class="field">Location
        <input name="location" type="text" value="${escapeAttr(s.location)}" />
      </label>
      <label class="field full">Tagline
        <input name="tagline" type="text" value="${escapeAttr(s.tagline)}" />
      </label>
      <label class="field full">About
        <textarea name="about">${escapeHtml(s.about)}</textarea>
      </label>
      <label class="field">Email
        <input name="email" type="email" value="${escapeAttr(s.email)}" />
      </label>
      <label class="field">CMS password
        <input name="password" type="text" value="${escapeAttr(s.password)}" />
      </label>
      <div class="btn-row full">
        <button class="btn btn-primary" type="submit">Save settings</button>
      </div>
    </form>
    <hr style="border:0;border-top:1px solid var(--line);margin:2rem 0" />
    <p>Reset seed data restores the original 10 published projects, 1 draft, and default password <code>atelier</code>.</p>
    <button class="btn btn-danger" id="reset-seed">Reset seed data</button>`,
    { active: "settings" }
  );
  bindChrome();
  document.getElementById("settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateSettings({
      name: String(fd.get("name") || "").trim(),
      tagline: String(fd.get("tagline") || "").trim(),
      about: String(fd.get("about") || ""),
      email: String(fd.get("email") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      password: String(fd.get("password") || ""),
    });
    const flash = document.createElement("div");
    flash.className = "flash";
    flash.textContent = "Settings saved.";
    e.target.prepend(flash);
  });
  document.getElementById("reset-seed").addEventListener("click", () => {
    const host = document.getElementById("modal-host");
    host.innerHTML = `
      <div class="modal-back" id="reset-modal">
        <div class="modal" role="dialog" aria-modal="true">
          <h3>Reset all data?</h3>
          <p>This replaces projects and settings with the original seed and clears uploaded media in this browser.</p>
          <div class="btn-row">
            <button class="btn btn-danger" id="reset-yes">Reset</button>
            <button class="btn" id="reset-no">Cancel</button>
          </div>
        </div>
      </div>`;
    const close = () => (host.innerHTML = "");
    document.getElementById("reset-no").addEventListener("click", close);
    document.getElementById("reset-yes").addEventListener("click", async () => {
      const btn = document.getElementById("reset-yes");
      btn.disabled = true;
      btn.textContent = "Resetting...";
      await resetSeed();
      close();
      await render();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", esc);
      }
    });
  });
}

async function render() {
  await initStore();
  if (!isAuthed()) {
    await renderLogin();
    return;
  }
  const { view, id } = route();
  if (view === "projects" && id) await renderEditor(id);
  else if (view === "projects") await renderProjects();
  else if (view === "categories") await renderCategories();
  else if (view === "media") await renderMedia();
  else if (view === "settings") await renderSettings();
  else await renderDashboard();
}

window.addEventListener("hashchange", render);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && previewRef) {
    document.getElementById("preview-host") && (document.getElementById("preview-host").innerHTML = "");
    previewRef = null;
  }
});

await initStore();
await render();
