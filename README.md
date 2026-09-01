# Packaging Product Designer Portfolio

Working browser prototype: a premium public studio site plus a hidden CMS. No backend. Content lives in this browser (`localStorage` key `ppd-portfolio-para-gallery-v1`, IndexedDB `ppd-media`).

Brand name: **PARA Creative Origin**

## Run locally

```bash
npx serve .
```

Then open:

| Surface | URL |
|--------|-----|
| Public portfolio | http://localhost:3000/ |
| Private CMS | http://localhost:3000/manage |

**CMS password:** `atelier` (changeable in Settings)

## Deploy (get public + admin links)

Your site is **static** — no build step. After deploy:

| Surface | URL |
|--------|-----|
| **Public portfolio** | `https://YOUR-DOMAIN/` |
| **Admin CMS** | `https://YOUR-DOMAIN/manage` |

**CMS password:** `atelier`

---

### Option A — Vercel (recommended, ~2 min)

1. Login: `npx vercel login`
2. Deploy: `npx vercel --prod`
3. Use the URL Vercel prints, e.g.:
   - Public: `https://packaging-product-designer-portfolio.vercel.app/`
   - Admin: `https://packaging-product-designer-portfolio.vercel.app/manage`

Routing is in [`vercel.json`](vercel.json).

---

### Option B — Netlify Drop (no Git push)

1. Open [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the project folder (or a zip of it) onto the page
3. Netlify gives a URL like `https://random-name.netlify.app`
4. Admin: `https://random-name.netlify.app/manage`

Add a `_redirects` file for SPA routes if category links 404 (Vercel/Render configs already cover this elsewhere).

---

### Option C — Render (free static site)

1. Push code to GitHub (see below if push fails)
2. [dashboard.render.com](https://dashboard.render.com) → **New** → **Static Site**
3. Connect repo `M-Prathap/Packaging-Product-Designer-Portfolio`
4. Build command: *(leave empty or `echo ok`)* · Publish directory: `.`
5. Render reads [`render.yaml`](render.yaml) for SPA rewrites
6. URL: `https://para-creative-origin.onrender.com` (name may vary)
7. Admin: `https://para-creative-origin.onrender.com/manage`

---

### Option D — GitHub Pages

1. Push to `main` on GitHub
2. Repo **Settings** → **Pages** → Source: **GitHub Actions**
3. Workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) runs on push
4. Public: `https://m-prathap.github.io/Packaging-Product-Designer-Portfolio/`
5. Admin: `https://m-prathap.github.io/Packaging-Product-Designer-Portfolio/manage`

---

### If `git push` fails (HTTP 400/408)

The repo is ~69 MB (images). Try:

```bash
git -c http.postBuffer=524288000 -c http.version=HTTP/1.1 push -u origin main
```

Or use **GitHub Desktop** → Push origin (often more reliable).

Or deploy with **Vercel/Netlify from your machine** without GitHub (Options A or B).

---

## Deploy on Vercel (quick reference)

```bash
npx vercel login
npx vercel --prod
```

## What works

**Public**

- Editorial homepage with hero, category tiles, featured work
- Category galleries for all 7 practice areas
- Case studies (overview, challenge, concept, process, mockups, final design, video)
- About + contact form (in-browser success; no server)
- Draft projects stay hidden

**CMS (`/manage`)**

- Password gate (session clears when the tab closes)
- Dashboard stats
- Create / edit / delete projects (delete confirms first)
- Cover + gallery uploads, replace, delete, drag-and-drop reorder
- Categories, media library, settings (name, tagline, about, email, password)
- Reset seed data

After you save in the CMS, refresh the public tab (or keep both open — the public page listens for storage updates).

## Defaults

- Brand: **PARA Creative Origin** (logo: `assets/images/para-logo.png`)
- Email: `hello@para.design`
- Seed images from regin.in reference pack (`assets/images/*.png`)
- Seed: 10 published projects + 1 draft across all categories

## Prototype limits

- The password only hides the CMS UI; it is not real server authentication
- Data stays in **this browser** and does not sync across devices
- Uploaded images are stored in IndexedDB, not cloud storage
