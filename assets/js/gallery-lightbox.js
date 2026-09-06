import { resolveSrc, getCategory } from "./store.js";

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function getProjectImageRefs(project) {
  return [...new Set([project.coverImageId, ...(project.imageIds || [])].filter(Boolean))];
}

export function createGalleryLightbox(root, { onScrollLockChange } = {}) {
  let project = null;
  let slides = [];
  let index = 0;
  let animating = false;
  let focusBefore = null;
  let keyHandler = null;
  let touchStartX = 0;
  let touchStartY = 0;

  const els = {
    root,
    backdrop: root.querySelector(".lightbox__backdrop"),
    title: root.querySelector(".lightbox__title"),
    counter: root.querySelector(".lightbox__counter"),
    close: root.querySelector(".lightbox__close"),
    prev: root.querySelector(".lightbox__prev"),
    next: root.querySelector(".lightbox__next"),
    stage: root.querySelector(".lightbox__stage"),
    viewport: root.querySelector(".lightbox__viewport"),
    figure: root.querySelector(".lightbox__figure"),
    image: root.querySelector(".lightbox__image"),
    stageFade: root.querySelector(".lightbox__stage-fade"),
    filmstrip: root.querySelector(".lightbox__filmstrip"),
    client: root.querySelector(".lightbox__client"),
  };

  function updateScrollState() {
    const vp = els.viewport;
    if (!vp) return;
    const scrollable = vp.scrollHeight > vp.clientHeight + 8;
    els.stage?.classList.toggle("is-scrollable", scrollable);
    const atBottom = vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 12;
    els.stage?.classList.toggle("is-scrolled-end", atBottom);
  }

  function scheduleScrollStateUpdate() {
    requestAnimationFrame(() => {
      updateScrollState();
      requestAnimationFrame(updateScrollState);
    });
  }

  function resetViewportScroll() {
    if (els.viewport) els.viewport.scrollTop = 0;
    scheduleScrollStateUpdate();
  }

  function bindViewportScroll() {
    els.viewport?.addEventListener("scroll", updateScrollState, { passive: true });
    els.image?.addEventListener("load", scheduleScrollStateUpdate);
    window.addEventListener("resize", scheduleScrollStateUpdate);
  }

  bindViewportScroll();

  function updateCounter() {
    if (!els.counter) return;
    els.counter.textContent = slides.length ? `${index + 1} / ${slides.length}` : "0 / 0";
  }

  function updateNav() {
    const single = slides.length > 1;
    if (els.prev) els.prev.hidden = !single;
    if (els.next) els.next.hidden = !single;
    if (els.prev) els.prev.disabled = animating;
    if (els.next) els.next.disabled = animating;
  }

  function updateFilmstripActive() {
    if (!els.filmstrip) return;
    els.filmstrip.querySelectorAll(".lightbox__thumb").forEach((btn, n) => {
      const active = n === index;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      if (active) {
        const desktop = window.matchMedia("(min-width: 901px)").matches;
        btn.scrollIntoView({
          behavior: "smooth",
          block: desktop ? "center" : "nearest",
          inline: desktop ? "nearest" : "center",
        });
      }
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

  function renderFilmstrip() {
    if (!els.filmstrip) return;
    els.filmstrip.innerHTML = slides
      .map((slide, i) => {
        const isActive = i === index;
        if (slide.type === "video") {
          return `
            <button
              type="button"
              class="lightbox__thumb lightbox__thumb--video ${isActive ? "is-active" : ""}"
              data-index="${i}"
              role="tab"
              aria-selected="${isActive ? "true" : "false"}"
              aria-label="Video slide ${i + 1}"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
              <span class="lightbox__thumb-label">Video</span>
            </button>`;
        }
        return `
          <button
            type="button"
            class="lightbox__thumb ${isActive ? "is-active" : ""}"
            data-index="${i}"
            role="tab"
            aria-selected="${isActive ? "true" : "false"}"
            aria-label="Image ${i + 1} of ${slides.length}"
          >
            <img src="${escapeAttr(slide.src)}" alt="" loading="lazy" decoding="async" />
          </button>`;
      })
      .join("");
  }

  async function renderSlide(i, { direction = 0, instant = false } = {}) {
    if (!slides.length || !els.figure) return;
    const slide = slides[i];
    if (!slide) return;

    const applySlide = () => {
      if (slide.type === "video") {
        if (slide.isFile) {
          els.figure.innerHTML = `<video class="lightbox__video" controls src="${escapeAttr(slide.src)}" playsinline autoplay></video>`;
        } else {
          els.figure.innerHTML = `<iframe class="lightbox__video-iframe" src="${escapeAttr(slide.src)}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
      } else {
        els.figure.innerHTML = `<img class="lightbox__image" src="${escapeAttr(slide.src)}" alt="${escapeAttr(slide.alt)}" decoding="async" />`;
      }
      index = i;
      resetViewportScroll();
      updateCounter();
      updateNav();
      updateFilmstripActive();
    };

    if (instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.figure.classList.remove("is-exit-left", "is-exit-right", "is-enter-left", "is-enter-right");
      applySlide();
      els.figure.classList.add("is-active");
      requestAnimationFrame(scheduleScrollStateUpdate);
      return;
    }

    animating = true;
    updateNav();
    const exitClass = direction > 0 ? "is-exit-left" : direction < 0 ? "is-exit-right" : "is-exit-left";
    const enterClass = direction > 0 ? "is-enter-right" : direction < 0 ? "is-enter-left" : "is-enter-right";

    els.figure.classList.remove("is-active", "is-enter-left", "is-enter-right", "is-exit-left", "is-exit-right");
    els.figure.classList.add(exitClass);

    await wait(220);
    applySlide();
    els.figure.classList.remove(exitClass);
    els.figure.classList.add(enterClass);

    requestAnimationFrame(() => {
      els.figure.classList.add("is-active");
    });

    await wait(420);
    els.figure.classList.remove(enterClass);
    animating = false;
    updateNav();
    scheduleScrollStateUpdate();
  }

  function go(delta) {
    if (!slides.length || animating) return;
    const next = (index + delta + slides.length) % slides.length;
    renderSlide(next, { direction: delta });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function open(nextProject, startIndex = 0) {
    project = nextProject;
    focusBefore = document.activeElement;
    const refs = getProjectImageRefs(project);
    const resolvedImages = await Promise.all(
      refs.map(async (ref, i) => {
        const src = await resolveSrc(ref);
        return src
          ? {
              type: "image",
              src,
              alt: `${project.title} — image ${i + 1}`,
            }
          : null;
      })
    );
    const imageSlides = resolvedImages.filter(Boolean);

    let videoSlide = null;
    if (project.videoFileId) {
      const src = await resolveSrc(project.videoFileId);
      if (src) {
        videoSlide = { type: "video", isFile: true, src, alt: `${project.title} — video` };
      }
    } else if (project.videoUrl) {
      const yt = youtubeId(project.videoUrl);
      const vim = vimeoId(project.videoUrl);
      if (yt) {
        videoSlide = { type: "video", isEmbed: true, src: `https://www.youtube.com/embed/${yt}`, alt: `${project.title} — video` };
      } else if (vim) {
        videoSlide = { type: "video", isEmbed: true, src: `https://player.vimeo.com/video/${vim}`, alt: `${project.title} — video` };
      }
    }

    slides = videoSlide ? [...imageSlides, videoSlide] : imageSlides;
    index = Math.min(Math.max(startIndex, 0), Math.max(slides.length - 1, 0));

    const cat = getCategory(project.categoryId);
    if (els.title) els.title.textContent = project.title;
    if (els.client) els.client.textContent = [cat?.name, project.client, project.year].filter(Boolean).join(" · ");

    renderFilmstrip();

    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
    onScrollLockChange?.();
    requestAnimationFrame(() => root.classList.add("is-open"));

    await renderSlide(index, { instant: true });
    els.close?.focus();
    bindKeys();
    bindTouch();
  }

  function close() {
    if (root.hidden) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    root.hidden = true;
    document.body.classList.remove("lightbox-open");
    unbindKeys();
    unbindTouch();
    if (els.figure) {
      els.figure.innerHTML = `<img class="lightbox__image" alt="" decoding="async" />`;
    }
    if (els.filmstrip) els.filmstrip.innerHTML = "";
    slides = [];
    project = null;
    animating = false;
    onScrollLockChange?.();
    if (focusBefore && typeof focusBefore.focus === "function") focusBefore.focus();
    focusBefore = null;
  }

  function bindKeys() {
    unbindKeys();
    keyHandler = (e) => {
      if (root.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    document.addEventListener("keydown", keyHandler);
  }

  function unbindKeys() {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }

  function onTouchStart(e) {
    if (!e.touches.length) return;
    if (!e.target.closest(".lightbox__viewport")) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    if (!e.changedTouches.length) return;
    if (!e.target.closest(".lightbox__viewport")) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? 1 : -1);
  }

  function bindTouch() {
    els.stage?.addEventListener("touchstart", onTouchStart, { passive: true });
    els.stage?.addEventListener("touchend", onTouchEnd, { passive: true });
  }

  function unbindTouch() {
    els.stage?.removeEventListener("touchstart", onTouchStart);
    els.stage?.removeEventListener("touchend", onTouchEnd);
  }

  els.backdrop?.addEventListener("click", close);
  els.close?.addEventListener("click", close);
  els.prev?.addEventListener("click", () => go(-1));
  els.next?.addEventListener("click", () => go(1));
  els.filmstrip?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-index]");
    if (!btn || animating) return;
    const i = Number(btn.getAttribute("data-index"));
    if (Number.isNaN(i) || i === index) return;
    renderSlide(i, { direction: i > index ? 1 : -1 });
  });

  return { open, close, isOpen: () => !root.hidden };
}
