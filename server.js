const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

/* ── Data directories ─────────────────────────────────────────────── */

const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const STATE_FILE = path.join(DATA_DIR, "portfolio.json");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ── Middleware ────────────────────────────────────────────────────── */

app.use(express.json({ limit: "10mb" }));

/* ── Multer (file uploads) ────────────────────────────────────────── */

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

/* ── API routes ───────────────────────────────────────────────────── */

// Portfolio state
app.get("/api/state", (_req, res) => {
  if (!fs.existsSync(STATE_FILE)) return res.json(null);
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    res.json(data);
  } catch {
    res.json(null);
  }
});

app.put("/api/state", (req, res) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to save state" });
  }
});

// File upload
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });
  res.json({
    filename: req.file.filename,
    originalName: req.file.originalname,
    mime: req.file.mimetype,
    size: req.file.size,
  });
});

// List uploaded files
app.get("/api/media", (_req, res) => {
  if (!fs.existsSync(UPLOADS_DIR)) return res.json([]);
  try {
    const files = fs.readdirSync(UPLOADS_DIR).map((name) => {
      const stats = fs.statSync(path.join(UPLOADS_DIR, name));
      return { id: name, name, size: stats.size };
    });
    res.json(files);
  } catch {
    res.json([]);
  }
});

// Serve an uploaded file (path-traversal safe)
app.get("/api/media/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
  res.sendFile(filePath);
});

// Delete an uploaded file
app.delete("/api/media/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// Reset to seed (clear server data — frontend will re-seed)
app.post("/api/reset", (_req, res) => {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  if (fs.existsSync(UPLOADS_DIR)) {
    fs.readdirSync(UPLOADS_DIR).forEach((f) =>
      fs.unlinkSync(path.join(UPLOADS_DIR, f))
    );
  }
  res.json({ ok: true });
});

/* ── Static files ─────────────────────────────────────────────────── */

app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(
  express.static(__dirname, {
    extensions: ["html"],
    index: "index.html",
  })
);

/* ── SPA fallback ─────────────────────────────────────────────────── */

app.get("/manage", (_req, res) =>
  res.sendFile(path.join(__dirname, "manage", "index.html"))
);
app.get("/manage/*", (_req, res) =>
  res.sendFile(path.join(__dirname, "manage", "index.html"))
);

const spaRoutes = [
  "/packaging",
  "/logo-branding",
  "/brochure-catalogue",
  "/invitation",
  "/banners",
  "/menu-card",
  "/videos",
  "/about",
  "/contact",
];
spaRoutes.forEach((route) => {
  app.get(route, (_req, res) =>
    res.sendFile(path.join(__dirname, "index.html"))
  );
});
app.get("/work/*", (_req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

/* ── Start ─────────────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`✔ Portfolio server running → http://localhost:${PORT}`);
});
