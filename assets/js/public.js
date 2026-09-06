import {
  initStore,
  getSettings,
  getCategories,
  getCategory,
  getProjects,
  getProject,
  resolveSrc,
  CHANGE_EVENT,
} from "./store.js";
import { createGalleryLightbox } from "./gallery-lightbox.js";

const app = document.getElementById("app");
const header = document.getElementById("site-header");
const toolbar = document.getElementById("toolbar");
const footer = document.getElementById("site-footer");
const wordmark = document.getElementById("wordmark");
const overlay = document.getElementById("nav-overlay");
const overlayNav = document.getElementById("overlay-nav");
const footerMeta = document.getElementById("footer-meta");
const toggle = document.getElementById("nav-toggle");
const overlayClose = document.getElementById("overlay-close");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const itemCount = document.getElementById("item-count");
const sharePageBtn = document.getElementById("share-page");
const lightboxRoot = document.getElementById("gallery-lightbox");
let lightbox = null;

let searchQuery = "";
let carouselIndex = 0;

const SIZE_PATTERN = ["item", "item", "wide", "item", "item", "tall", "item", "item", "wide", "item"];

function pathFromLocation() {
  let path = window.location.pathname;
  if (path.endsWith("/index.html")) path = "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const hash = window.location.hash.replace(/^#/, "");
  if ((path === "/" || path === "") && hash.startsWith("/")) return hash;
  return path || "/";
}

function syncPageScrollLock() {
  const menuOpen = !overlay.hidden && overlay.classList.contains("is-open");
  const galleryOpen = lightbox?.isOpen?.() ?? false;
  if (menuOpen || galleryOpen) {
    document.body.style.overflow = "hidden";
    return;
  }
  document.body.classList.remove("lightbox-open");
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
}

if (lightboxRoot) {
  lightbox = createGalleryLightbox(lightboxRoot, { onScrollLockChange: syncPageScrollLock });
}

function navigate(href, { replace = false } = {}) {
  lightbox?.close?.();
  const url = href.startsWith("/") ? href : `/${href}`;
  if (replace) history.replaceState({ path: url }, "", url);
  else history.pushState({ path: url }, "", url);
  render();
  window.scrollTo(0, 0);
}

let menuKeyHandler = null;
let menuFocusBefore = null;

function getOverlayFocusable() {
  return [...overlay.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

function closeMenu() {
  if (menuKeyHandler) {
    document.removeEventListener("keydown", menuKeyHandler);
    menuKeyHandler = null;
  }
  overlay.classList.remove("is-open");
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  toggle.setAttribute("aria-expanded", "false");
  syncPageScrollLock();
  if (menuFocusBefore && typeof menuFocusBefore.focus === "function") {
    menuFocusBefore.focus();
  }
  menuFocusBefore = null;
}

function openMenu() {
  menuFocusBefore = document.activeElement;
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  toggle.setAttribute("aria-expanded", "true");
  syncPageScrollLock();
  overlayClose.focus();

  menuKeyHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = getOverlayFocusable();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  document.addEventListener("keydown", menuKeyHandler);
}

function overlayNavMarkup(current) {
  const cats = getCategories();
  const links = [
    { href: "/", label: "All work" },
    ...cats.map((c) => ({ href: `/${c.slug}`, label: c.name })),
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];
  return links
    .map((item) => {
      const active = item.href === current || (item.href !== "/" && current.startsWith(item.href));
      return `<a href="${item.href}" ${active ? 'aria-current="page"' : ""}>${item.label}</a>`;
    })
    .join("");
}

function brandName(settings = getSettings()) {
  return settings.name || "PARA Creative Origin";
}

function bindIdentity() {
  const s = getSettings();
  const brand = brandName(s);
  const logo = document.getElementById("wordmark-logo");
  const nameEl = document.getElementById("wordmark-name");
  const primaryEl = nameEl?.querySelector(".wordmark__line--primary");
  const secondaryEl = nameEl?.querySelector(".wordmark__line--secondary");
  const parts = brand.trim().split(/\s+/);
  const primary = parts[0] || brand;
  const secondary = parts.slice(1).join(" ");

  if (logo) logo.alt = brand;
  if (primaryEl) primaryEl.textContent = primary;
  if (secondaryEl) {
    secondaryEl.textContent = secondary;
    secondaryEl.hidden = !secondary;
  }
  wordmark.setAttribute("aria-label", `${brand} home`);
  footerMeta.textContent = `${brand} · ${s.email}`;
}

function populateCategoryFilter(selectedSlug = "") {
  const cats = getCategories();
  const options = [`<option value="">All categories</option>`]
    .concat(
      cats.map((c) => `<option value="${c.slug}" ${selectedSlug === c.slug ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    )
    .join("");
  categoryFilter.innerHTML = options;
}

function setChromeMode(mode) {
  const isGallery = mode === "gallery";
  const isStage = mode === "stage";
  document.body.classList.toggle("mode-gallery", isGallery);
  document.body.classList.toggle("mode-stage", isStage);
  document.body.classList.toggle("mode-page", mode === "page");
  toolbar.hidden = !isGallery;
  footer.hidden = isStage;
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function pseudoViews(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 900;
  return 120 + h;
}

async function img(ref, alt, extra = "") {
  const src = await resolveSrc(ref);
  if (!src) return "";
  return `<img src="${src}" alt="${escapeAttr(alt)}" ${extra} />`;
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function categoryName(id) {
  return getCategory(id)?.name || "";
}

function filterProjects({ categorySlug = "", query = "" } = {}) {
  let list = getProjects({ publishedOnly: true });
  if (categorySlug) {
    const cat = getCategory(categorySlug);
    if (cat) list = list.filter((p) => p.categoryId === cat.id);
  }
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => {
      const hay = [p.title, p.client, p.description, p.overview, categoryName(p.categoryId)]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}

async function renderGallery({ categorySlug = "", query = "" } = {}) {
  setChromeMode("gallery");
  populateCategoryFilter(categorySlug);
  const list = filterProjects({ categorySlug, query });
  itemCount.textContent = `Showing ${list.length} item${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    app.innerHTML = `
      <div class="gallery-empty">
        <h1>No projects found</h1>
        <p>Try another category or search term.</p>
      </div>`;
    return;
  }

  const cards = await Promise.all(
    list.map(async (p, i) => {
      const cover = await img(p.coverImageId, p.title, i > 3 ? 'loading="lazy"' : "");
      const size = SIZE_PATTERN[i % SIZE_PATTERN.length];
      const views = pseudoViews(p.id);
      const hasVideo = Boolean(p.videoFileId || p.videoUrl);
      const mediaCount = [...new Set([p.coverImageId, ...(p.imageIds || [])].filter(Boolean))].length + (hasVideo ? 1 : 0);
      const mediaLabel = hasVideo ? `${mediaCount} media` : `${mediaCount} images`;
      return `
        <button type="button" class="grid-card grid-card--${size} grid-card--enter" data-project-id="${escapeAttr(p.id)}" style="--stagger:${delay}s" aria-label="Open ${escapeAttr(p.title)} gallery">
          <figure class="grid-card__media">${cover}</figure>
          <div class="grid-card__shine" aria-hidden="true"></div>
          <div class="grid-card__view" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div class="grid-card__overlay">
            <div class="grid-card__title">${escapeHtml(p.title)}</div>
            <div class="grid-card__meta">
              <span>${escapeHtml(formatDate(p.updatedAt || p.createdAt))}</span>
              <span class="grid-card__stat">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                ${views}
              </span>
              <span class="grid-card__stat grid-card__count">${mediaLabel}</span>
            </div>
          </div>
        </button>`;
    })
  );

  app.innerHTML = `<div class="masonry-grid masonry-grid--live">${cards.join("")}</div>`;
  observeGridCards();
  bindGalleryCards();
}

function bindGalleryCards() {
  app.querySelectorAll("[data-project-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-project-id");
      const project = getProject(id);
      if (project && lightbox) lightbox.open(project);
    });
  });
}

function observeGridCards() {
  const grid = app.querySelector(".masonry-grid");
  const cards = app.querySelectorAll(".grid-card--enter:not(.is-visible)");
  if (!cards.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cards.forEach((c) => c.classList.add("is-visible"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
  );

  cards.forEach((c) => io.observe(c));

  requestAnimationFrame(() => {
    grid?.classList.add("is-ready");
  });
}

function youtubeId(url) {
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

function vimeoId(url) {
  if (!url) return "";
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : "";
}

async function videoBlock(project) {
  if (project.videoFileId) {
    const src = await resolveSrc(project.videoFileId);
    if (src) {
      return `<div class="stage-video"><video controls src="${src}" playsinline></video></div>`;
    }
  }
  if (project.videoUrl) {
    const yt = youtubeId(project.videoUrl);
    if (yt) {
      return `<div class="stage-video"><iframe src="https://www.youtube.com/embed/${yt}" title="Project film" allowfullscreen></iframe></div>`;
    }
    const vim = vimeoId(project.videoUrl);
    if (vim) {
      return `<div class="stage-video"><iframe src="https://player.vimeo.com/video/${vim}" title="Project film" allowfullscreen></iframe></div>`;
    }
  }
  return "";
}

function bindCarousel(slides) {
  if (!slides.length) return;
  carouselIndex = 0;
  const track = document.getElementById("carousel-track");
  const dots = document.getElementById("carousel-dots");
  const prev = document.getElementById("carousel-prev");
  const next = document.getElementById("carousel-next");
  if (!track) return;

  const go = (idx) => {
    carouselIndex = (idx + slides.length) % slides.length;
    track.style.transform = `translateX(-${carouselIndex * 100}%)`;
    dots?.querySelectorAll("button").forEach((btn, i) => {
      btn.classList.toggle("is-active", i === carouselIndex);
      btn.setAttribute("aria-selected", i === carouselIndex ? "true" : "false");
    });
  };

  prev?.addEventListener("click", () => go(carouselIndex - 1));
  next?.addEventListener("click", () => go(carouselIndex + 1));
  dots?.querySelectorAll("button").forEach((btn, i) => {
    btn.addEventListener("click", () => go(i));
  });

  document.addEventListener("keydown", function carouselKeys(e) {
    if (!document.getElementById("carousel-track")) {
      document.removeEventListener("keydown", carouselKeys);
      return;
    }
    if (e.key === "ArrowLeft") go(carouselIndex - 1);
    if (e.key === "ArrowRight") go(carouselIndex + 1);
  });
}

async function renderCase(id) {
  const p = getProject(id);
  if (!p || p.status !== "published") {
    renderNotFound();
    return;
  }
  setChromeMode("stage");
  const cat = getCategory(p.categoryId);
  const allRefs = [...new Set([p.coverImageId, ...(p.imageIds || [])].filter(Boolean))];
  const slides = await Promise.all(
    allRefs.map(async (ref, i) => {
      const el = await img(ref, `${p.title} — image ${i + 1}`, i === 0 ? 'fetchpriority="high"' : 'loading="lazy"');
      return `<div class="carousel-slide">${el}</div>`;
    })
  );
  const dots = slides
    .map((_, i) => `<button type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" class="${i === 0 ? "is-active" : ""}"></button>`)
    .join("");
  const video = await videoBlock(p);
  const views = pseudoViews(p.id);
  const tags = [cat?.name, p.client, p.year].filter(Boolean);

  app.innerHTML = `
    <article class="stage">
      <div class="stage__top">
        <div class="stage__tags">
          ${tags.map((t) => `<span class="stage-tag">${escapeHtml(t)}</span>`).join("")}
        </div>
        <div class="stage__stats">
          <span class="stage-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
            ${views}
          </span>
          <span class="stage-stat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/></svg>
            0
          </span>
          <button class="stage-stat stage-stat--btn" type="button" id="case-share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"></path></svg>
            Share
          </button>
        </div>
      </div>

      <div class="carousel" aria-label="${escapeAttr(p.title)} gallery">
        <button class="carousel__nav carousel__nav--prev" type="button" id="carousel-prev" aria-label="Previous image">&lsaquo;</button>
        <div class="carousel__viewport">
          <div class="carousel__track" id="carousel-track">${slides.join("")}</div>
        </div>
        <button class="carousel__nav carousel__nav--next" type="button" id="carousel-next" aria-label="Next image">&rsaquo;</button>
        <div class="carousel__dots" id="carousel-dots" role="tablist">${dots}</div>
      </div>

      <div class="stage__body">
        <h1 class="stage__title">${escapeHtml(p.title)}</h1>
        <div class="stage__copy">
          ${p.overview ? `<p><strong>Overview.</strong> ${escapeHtml(p.overview)}</p>` : ""}
          ${p.challenge ? `<p><strong>Challenge.</strong> ${escapeHtml(p.challenge)}</p>` : ""}
          ${p.concept ? `<p><strong>Concept.</strong> ${escapeHtml(p.concept)}</p>` : ""}
          ${p.process ? `<p><strong>Process.</strong> ${escapeHtml(p.process)}</p>` : ""}
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ""}
        </div>
        ${video}
        <a class="stage__back" href="/">← Back to gallery</a>
      </div>
    </article>`;

  bindCarousel(slides);
  document.getElementById("case-share")?.addEventListener("click", shareCurrentPage);
}

function renderAbout() {
  setChromeMode("page");
  const s = getSettings();
  app.innerHTML = `
    <div class="page-card">
      <h1>${escapeHtml(brandName(s))}</h1>
      <p class="page-card__lead">Packaging, print, and brand systems for products that deserve to be seen.</p>
      <div class="page-card__body">
        <p>${escapeHtml(s.about)}</p>
        <p>${escapeHtml(s.location)} · <a href="mailto:${escapeAttr(s.email)}">${escapeHtml(s.email)}</a></p>
      </div>
      <a class="btn-accent btn-accent--solid" href="/contact">Contact us</a>
    </div>`;
}

function renderContact() {
  setChromeMode("page");
  const s = getSettings();
  const types = getCategories()
    .map((c) => `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)}</option>`)
    .join("");
  app.innerHTML = `
    <div class="page-card page-card--wide">
      <h1>Contact us</h1>
      <p class="page-card__lead">Tell us about your product, pack, or print project.</p>
      <form class="contact-form" id="contact-form" action="https://api.web3forms.com/submit" method="POST">
        <input type="hidden" name="access_key" value="474672e2-5b76-45be-97dc-2f25fc2a2b54">
        <label>Name
          <input name="name" type="text" required autocomplete="name" />
        </label>
        <label>Email
          <input name="email" type="email" required autocomplete="email" />
        </label>
        <label>Project type
          <select name="type" required>
            <option value="">Select</option>
            ${types}
          </select>
        </label>
        <label>Message
          <textarea name="message" required></textarea>
        </label>
        <button class="btn-accent btn-accent--solid" type="submit" id="contact-submit">Send message</button>
      </form>
      <p class="contact-note">Email <a href="mailto:${escapeAttr(s.email)}">${escapeHtml(s.email)}</a> for direct inquiries.</p>
    </div>`;

  const form = document.getElementById("contact-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("contact-submit");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      const formData = new FormData(form);
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const wrap = form.closest(".page-card");
        wrap.innerHTML = `
          <div class="form-success">
            <h2>Message sent!</h2>
            <p>Thank you for reaching out. We will get back to you soon.</p>
            <a class="btn-accent btn-accent--solid" href="/">Back to gallery</a>
          </div>`;
      } else {
        alert(data.message || "Something went wrong. Please try again.");
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (err) {
      alert("Failed to send message. Please check your internet connection.");
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

function renderNotFound() {
  setChromeMode("page");
  app.innerHTML = `
    <div class="gallery-empty">
      <h1>Page not found</h1>
      <p>That project or page is not in the studio.</p>
      <a class="btn-accent btn-accent--solid" href="/">Back to gallery</a>
    </div>`;
}

async function shareCurrentPage() {
  const url = window.location.href;
  const title = document.title;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    sharePageBtn.textContent = "Link copied";
    setTimeout(() => {
      sharePageBtn.innerHTML = `<span>Share this page</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5"></path></svg>`;
    }, 2000);
  } catch {
    window.prompt("Copy this link:", url);
  }
}

async function render() {
  const path = pathFromLocation();
  if (path === "/manage" || path.startsWith("/manage/")) {
    window.location.replace("/manage/");
    return;
  }

  bindIdentity();
  const settings = getSettings();
  const brand = brandName(settings);
  overlayNav.innerHTML = overlayNavMarkup(path);

  const work = path.match(/^\/work\/([^/]+)$/);
  const catSlug = path.replace(/^\//, "");
  const cat = getCategory(catSlug);

  if (work) {
    document.title = `${getProject(work[1])?.title || brand} — ${brand}`;
    await renderCase(work[1]);
  } else if (path === "/about") {
    document.title = `About — ${brand}`;
    renderAbout();
  } else if (path === "/contact") {
    document.title = `Contact — ${brand}`;
    renderContact();
  } else if (cat) {
    document.title = `${cat.name} — ${brand}`;
    searchQuery = searchInput.value;
    await renderGallery({ categorySlug: cat.slug, query: searchQuery });
  } else if (path === "/") {
    document.title = `${brand} — Packaging & Branding`;
    searchQuery = searchInput.value;
    await renderGallery({ query: searchQuery });
  } else {
    document.title = brand;
    renderNotFound();
  }

  app.classList.remove("page-enter");
  void app.offsetWidth;
  app.classList.add("page-enter");
}

function onClick(e) {
  const a = e.target.closest("a");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href || href.startsWith("mailto:") || href.startsWith("http") || href.startsWith("#")) return;
  if (a.origin && a.origin !== window.location.origin) return;
  if (href.startsWith("/manage")) return;
  if (lightbox?.isOpen?.()) return;
  e.preventDefault();
  closeMenu();
  navigate(href);
}

categoryFilter.addEventListener("change", () => {
  const slug = categoryFilter.value;
  navigate(slug ? `/${slug}` : "/");
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  const path = pathFromLocation();
  const work = path.match(/^\/work\//);
  if (work) return;
  if (path === "/about" || path === "/contact") return;
  const cat = getCategory(path.replace(/^\//, ""));
  renderGallery({ categorySlug: cat?.slug || "", query: searchQuery });
});

sharePageBtn.addEventListener("click", shareCurrentPage);

toggle.addEventListener("click", () => {
  if (overlay.hidden) openMenu();
  else closeMenu();
});
overlayClose.addEventListener("click", closeMenu);
overlayNav.addEventListener("click", (e) => {
  if (e.target.closest("a")) closeMenu();
});
document.addEventListener("click", onClick);
window.addEventListener("popstate", render);
window.addEventListener("hashchange", render);
window.addEventListener(CHANGE_EVENT, render);

await initStore();
await render();
