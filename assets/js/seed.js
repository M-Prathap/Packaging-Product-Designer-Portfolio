/**
 * Seed portfolio from regin.in reference assets (assets/images/*.png).
 */

export const CATEGORIES = [
  { id: "cat-packaging", slug: "packaging", name: "Packaging" },
  { id: "cat-logo", slug: "logo-branding", name: "Logo & Branding" },
  { id: "cat-brochure", slug: "brochure-catalogue", name: "Brochure / Catalogue" },
  { id: "cat-invitation", slug: "invitation", name: "Invitation" },
  { id: "cat-banners", slug: "banners", name: "Banners" },
  { id: "cat-menu", slug: "menu-card", name: "Menu Card" },
  { id: "cat-videos", slug: "videos", name: "Videos" },
];

export const CATEGORY_INTROS = {
  packaging: "Product packaging, pouches, boxes, labels, and shelf-ready design for FMCG and food brands.",
  "logo-branding": "Logo marks and brand identity systems built to work on pack, print, and signage.",
  "brochure-catalogue": "Catalogues, websites, and printed brand volumes with strong product storytelling.",
  invitation: "Invitation suites, event papers, and hospitality print for memorable moments.",
  banners: "Retail banners, posters, and large-format design for markets, stores, and campaigns.",
  "menu-card": "Menu cards, bakery labels, and hospitality print designed for daily use.",
  videos: "Product films and motion studies that extend packaging into moving light.",
};

const S = (file) => `static:${file}`;

const IMAGE_POOLS = {
  "cat-packaging": [
    "jagan-pistachio_1778410608.png",
    "lion-overseas-cashew-pouch-512025_1782017120.png",
    "vaspal-crystal-salt_1782015971.png",
    "vaspal-iodized-salt_1112022_1782016186.png",
    "golden-star-whole-spices-23102024_1779462491.png",
    "cocobliss-neera-22122023_1779462056.png",
    "ramara-walnut-1032026_1779463113.png",
    "jorday-milk-halwa-2662024_1779462937.png",
    "higard-matbot-2052025_1778476733.png",
    "crunchy-makhana-722025_1776497768.png",
    "green-fresh-cardamom-31102023_1778415347.png",
    "a1-batter-0204202_1770438822.png",
    "anbin-suvai-batter_1775107851.png",
    "dheepam-insence-sticks-742025_1775299569.png",
    "mass-drink-31122025_1775108209.png",
    "maudlin-soap_1775108445.png",
    "surya-tea-762025_1775389700.png",
    "thamarai-mazafathi-dates-box-1092025_1775720863.png",
    "vibu-cashew-2122024_1776498231.png",
  ],
  "cat-logo": [
    "netta-care-logo-972025_1782016802.png",
    "alice-supermarket-logo_1779461100.png",
    "arunavilas-logo-1472025_1778413978.png",
    "og-oh-gosh-logo-1662025_1778411367.png",
    "sevvel-logo-262025_1778413616.png",
    "para-logo.png",
    "logo.png",
  ],
  "cat-brochure": ["uthra-website-15052025_1775637918.png", "designers-wanted-562026_1780653785.png"],
  "cat-invitation": ["unar-resort-25022025_1778482980.png", "Thankyou-image.png", "contactus-Thankyou-image.png"],
  "cat-banners": ["designers-wanted-562026_1780653785.png", "uthra-website-15052025_1775637918.png"],
  "cat-menu": [
    "navin-bakery-baby-rusk-262025_1775632603.png",
    "navin-bakery-bread-872025_1775721276.png",
    "navin-bakery-fast-foods-872025_1775390083.png",
  ],
  "cat-videos": ["jagan-pistachio_1778410608.png", "lion-overseas-cashew-pouch-512025_1782017120.png"],
};

function buildGalleryImages(primaryFile, categoryId, order) {
  const pool = IMAGE_POOLS[categoryId] || IMAGE_POOLS["cat-packaging"];
  const total = 4 + (order % 2);
  const refs = [S(primaryFile)];
  const extras = pool.filter((file) => file !== primaryFile);
  const start = order % Math.max(extras.length, 1);
  for (let i = 0; refs.length < total && i < extras.length * 2; i += 1) {
    const file = extras[(start + i) % extras.length];
    const ref = S(file);
    if (!refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

function project(partial) {
  return {
    description: "",
    overview: "",
    challenge: "",
    concept: "",
    process: "",
    status: "published",
    coverImageId: "",
    imageIds: [],
    videoUrl: "",
    videoFileId: "",
    createdAt: "2025-06-01T10:00:00.000Z",
    updatedAt: "2025-08-28T10:00:00.000Z",
    ...partial,
  };
}

const SEED_ITEMS = [
  // Packaging
  ["proj-jagan-pistachio", "Jagan Dryfruits Salted Pistachio", "Jagan Dryfruits", "cat-packaging", "2025", 1, "jagan-pistachio_1778410608.png"],
  ["proj-lion-cashew", "Lion Overseas Cashew Pouch", "Lion Overseas", "cat-packaging", "2025", 2, "lion-overseas-cashew-pouch-512025_1782017120.png"],
  ["proj-vaspal-crystal", "Vaspal Crystal Salt", "Vaspal", "cat-packaging", "2025", 3, "vaspal-crystal-salt_1782015971.png"],
  ["proj-vaspal-iodized", "Vaspal Iodized Salt", "Vaspal", "cat-packaging", "2024", 4, "vaspal-iodized-salt-1112022_1782016186.png"],
  ["proj-golden-star", "Golden Star Whole Spices", "Golden Star", "cat-packaging", "2024", 5, "golden-star-whole-spices-23102024_1779462491.png"],
  ["proj-cocobliss", "Coco Bliss Neera", "Coco Bliss", "cat-packaging", "2023", 6, "cocobliss-neera-22122023_1779462056.png"],
  ["proj-ramara", "Ramara Walnut Kernels", "Ramara", "cat-packaging", "2026", 7, "ramara-walnut-1032026_1779463113.png"],
  ["proj-jorday", "JORDAY Milk Halwa", "JORDAY", "cat-packaging", "2024", 8, "jorday-milk-halwa-2662024_1779462937.png"],
  ["proj-higard", "Higard Matbot Matic", "Higard", "cat-packaging", "2025", 9, "higard-matbot-2052025_1778476733.png"],
  ["proj-makhana", "Crunchy Makhana", "Crunchy", "cat-packaging", "2025", 10, "crunchy-makhana-722025_1776497768.png"],
  ["proj-cardamom", "Green Fresh Cardamom", "Green Fresh", "cat-packaging", "2023", 11, "green-fresh-cardamom-31102023_1778415347.png"],
  ["proj-a1-batter", "A1 Batter", "A1 Foods", "cat-packaging", "2024", 12, "a1-batter-0204202_1770438822.png"],
  ["proj-anbin", "Anbin Suvai Batter", "Anbin Suvai", "cat-packaging", "2025", 13, "anbin-suvai-batter_1775107851.png"],
  ["proj-dheepam", "Dheepam Incense Sticks", "Dheepam", "cat-packaging", "2025", 14, "dheepam-insence-sticks-742025_1775299569.png"],
  ["proj-mass-drink", "Mass Drink", "Mass Beverages", "cat-packaging", "2025", 15, "mass-drink-31122025_1775108209.png"],
  ["proj-maudlin", "Maudlin Soap", "Maudlin", "cat-packaging", "2025", 16, "maudlin-soap_1775108445.png"],
  ["proj-surya-tea", "Surya Tea", "Surya", "cat-packaging", "2025", 17, "surya-tea-762025_1775389700.png"],
  ["proj-dates", "Thamarai Mazafathi Dates", "Thamarai", "cat-packaging", "2025", 18, "thamarai-mazafathi-dates-box-1092025_1775720863.png"],
  ["proj-vibu", "Vibu Cashew", "Vibu", "cat-packaging", "2024", 19, "vibu-cashew-2122024_1776498231.png"],
  // Logo & branding
  ["proj-netta-care", "Netta Care Logo", "Netta Care", "cat-logo", "2025", 20, "netta-care-logo-972025_1782016802.png"],
  ["proj-alice", "Alice Supermarket Logo", "Alice Supermarket", "cat-logo", "2025", 21, "alice-supermarket-logo_1779461100.png"],
  ["proj-arunavilas", "Arunavilas Logo", "Arunavilas", "cat-logo", "2025", 22, "arunavilas-logo-1472025_1778413978.png"],
  ["proj-og-gosh", "OG Oh Gosh Logo", "OG Oh Gosh", "cat-logo", "2025", 23, "og-oh-gosh-logo-1662025_1778411367.png"],
  ["proj-sevvel", "Sevvel Logo", "Sevvel", "cat-logo", "2025", 24, "sevvel-logo-262025_1778413616.png"],
  // Brochure / catalogue
  ["proj-uthra", "Uthra Website", "Uthra", "cat-brochure", "2025", 25, "uthra-website-15052025_1775637918.png"],
  // Invitation
  ["proj-unar", "Unar Resort", "Unar Resort", "cat-invitation", "2025", 26, "unar-resort-25022025_1778482980.png"],
  // Banners
  ["proj-designers", "Designers Wanted", "Regin Studio", "cat-banners", "2026", 27, "designers-wanted-562026_1780653785.png"],
  // Menu card
  ["proj-navin-rusk", "Navin Bakery Baby Rusk", "Navin Bakery", "cat-menu", "2025", 28, "navin-bakery-baby-rusk-262025_1775632603.png"],
  ["proj-navin-bread", "Navin Bakery Bread", "Navin Bakery", "cat-menu", "2025", 29, "navin-bakery-bread-872025_1775721276.png"],
  ["proj-navin-fast", "Navin Bakery Fast Foods", "Navin Bakery", "cat-menu", "2025", 30, "navin-bakery-fast-foods-872025_1775390083.png"],
  // Videos
  ["proj-jagan-video", "Jagan Pistachio Film", "Jagan Dryfruits", "cat-videos", "2025", 31, "jagan-pistachio_1778410608.png", true],
  // Draft
  ["proj-draft-cardamom", "Green Cardamom — Draft", "Green Fresh", "cat-packaging", "2026", 99, "green-fresh-cardamom-31102023_1778415347.png", false, "draft"],
];

function buildFromSeedItem(row) {
  const [id, title, client, categoryId, year, order, file, isVideo, status] = row;
  const gallery = buildGalleryImages(file, categoryId, order);
  const img = gallery[0];
  const published = status !== "draft";
  return project({
    id,
    title,
    client,
    categoryId,
    year,
    order,
    status: published ? "published" : "draft",
    coverImageId: img,
    imageIds: gallery,
    description: `${title} — packaging and print design for ${client}.`,
    overview: `${client} needed packaging that reads clearly on shelf, in hand, and in photography. This project covers the full visual system from pack face to mockup.`,
    challenge: "Stand out in a crowded retail set without losing legibility at small sizes or under mixed store lighting.",
    concept: "Bold product photography, clear hierarchy, and colour blocks that survive print and pouch production.",
    process: "Concept boards, dieline checks, print proofs, and final mockups photographed for portfolio and client sign-off.",
    videoUrl: isVideo === true && categoryId === "cat-videos" ? "https://www.youtube.com/watch?v=aqz-KE-bpKQ" : "",
    createdAt: "2025-08-01T09:00:00.000Z",
    updatedAt: "2025-08-28T15:00:00.000Z",
  });
}

export function buildSeed() {
  return {
    settings: {
      name: "PARA Creative Origin",
      tagline: "Packaging that makes products impossible to ignore.",
      about:
        "PARA Creative Origin is a packaging and branding studio for FMCG, food, beverage, and retail brands. Work spans pouches, boxes, labels, logos, menus, banners, and product films — built to perform on shelf and in camera.\n\nEvery project is designed for real production: dielines, print constraints, and the way customers actually pick up a product.",
      email: "hello@para.design",
      location: "Studio",
      password: "atelier",
    },
    categories: CATEGORIES,
    projects: [],
  };
}
