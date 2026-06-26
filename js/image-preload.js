/**
 * Preconnect + preload remote images from SITE_CONFIG so photos/icons appear instantly.
 */
(function (global) {
  const PRELOADED = new Set();
  let started = false;

  const CONFIG_IMAGE_KEYS = [
    "brandLogoUrl",
    "ownerPhotoUrl",
    "honorableMentionPhotoUrl",
    "contributorsVerifiedBadgeUrl",
    "telegramTeamAvatar",
    "telegramAppIcon",
    "ownerPhoneIcon",
    "ownerCalIcon",
    "ownerStoreIcon",
  ];

  function isImageUrl(value) {
    const s = String(value || "").trim();
    return /^https?:\/\//i.test(s) && /\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(s);
  }

  function normalizeUrl(url) {
    return String(url || "").trim();
  }

  function preconnectHosts() {
    ["https://raw.githubusercontent.com", "https://github.com"].forEach((href) => {
      if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = href;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }

  function preloadOne(url, priority) {
    const href = normalizeUrl(url);
    if (!href || PRELOADED.has(href)) return;
    PRELOADED.add(href);

    if (!document.querySelector('link[rel="preload"][as="image"][href="' + href + '"]')) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      if (priority === "high" && "fetchPriority" in link) link.fetchPriority = "high";
      document.head.appendChild(link);
    }

    const img = new Image();
    if (priority === "high" && "fetchPriority" in img) img.fetchPriority = "high";
    img.decoding = "async";
    img.src = href;
  }

  function collectConfigUrls() {
    const c = global.SITE_CONFIG || {};
    const urls = new Set();
    CONFIG_IMAGE_KEYS.forEach((key) => {
      if (c[key]) urls.add(normalizeUrl(c[key]));
    });
    Object.values(c).forEach((val) => {
      if (isImageUrl(val)) urls.add(normalizeUrl(val));
    });
    return [...urls].filter(Boolean);
  }

  function ensureFavicon() {
    const c = global.SITE_CONFIG || {};
    const url = normalizeUrl(c.brandLogoUrl || c.telegramTeamAvatar);
    if (!url) return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function init() {
    if (started) return;
    if (document.documentElement?.dataset?.loginRedirect === "entry") return;
    started = true;
    preconnectHosts();
    ensureFavicon();
    const urls = collectConfigUrls();
    urls.forEach((url, i) => preloadOne(url, i === 0 ? "high" : "auto"));
    preloadOne(
      "https://raw.githubusercontent.com/Delexoo/Sales-Dashboard/main/doc/Default.jpg",
      "high"
    );
  }

  function warmDocumentImages(root) {
    (root || document).querySelectorAll("img[src]").forEach((el) => {
      const src = el.getAttribute("src");
      if (!src || src.startsWith("blob:") || src.startsWith("data:")) return;
      preloadOne(src, el.getAttribute("fetchpriority") === "high" ? "high" : "auto");
    });
  }

  global.SiteImagePreload = { init, preloadOne, warmDocumentImages, collectConfigUrls };
  init();
})(window);
