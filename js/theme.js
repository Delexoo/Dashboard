/**
 * Applies light / dark / system theme before paint (load on every app page).
 */
(function (global) {
  const DEVICE_KEY = "lpc_device_theme_v1";
  const PREFS_KEY = "lpc_user_prefs_v1";

  function repScopedKey(base) {
    const id = global.RepSession?.get?.()?.id;
    return id ? "lpc_rep_" + id + "_" + base : base;
  }

  function readPrefsRaw() {
    try {
      const raw =
        global.RepStorage?.loadItem?.(PREFS_KEY) ||
        localStorage.getItem(repScopedKey(PREFS_KEY));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function readTheme() {
    const prefs = readPrefsRaw();
    const c = normalizeUiColor(prefs?.uiColor);
    if (["cream", "current", "white", "green", "grey", "blue", "purple", "red"].includes(c)) return "light";
    if (c === "black") return "dark";
    const device = localStorage.getItem(DEVICE_KEY);
    if (device === "light" || device === "dark" || device === "system") return device;
    const t = prefs?.theme;
    if (t === "light" || t === "dark" || t === "system") return t;
    return "light";
  }

  function normalizeUiColor(c) {
    if (c === "current") return "cream";
    return c;
  }

  function readUiColor() {
    const c = normalizeUiColor(readPrefsRaw()?.uiColor);
    return ["cream", "white", "black", "green", "grey", "blue", "purple", "red"].includes(c) ? c : "white";
  }

  function readReduceMotion() {
    const prefs = readPrefsRaw();
    if (prefs?.reduceMotion === true) return true;
    return !!global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  let themeSwitchTimer = null;
  let themeApplied = false;

  /**
   * Suppress all transitions for the frame where the theme/color swaps so the
   * whole UI repaints in one consistent step instead of a glitchy color sweep.
   */
  function suppressThemeTransitions(html) {
    html.classList.add("theme-switching");
    if (themeSwitchTimer) clearTimeout(themeSwitchTimer);
    themeSwitchTimer = setTimeout(() => {
      html.classList.remove("theme-switching");
      themeSwitchTimer = null;
    }, 80);
  }

  function apply(theme, reduceMotion) {
    const html = document.documentElement;
    const prevTheme = html.getAttribute("data-theme");
    const prevUiColor = html.getAttribute("data-ui-color");

    let nextTheme;
    if (theme === "light") {
      nextTheme = "light";
    } else if (theme === "dark") {
      nextTheme = "dark";
    } else {
      const prefersDark = global.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      nextTheme = prefersDark ? "dark" : "light";
    }

    const uiColor = readUiColor();
    const nextUiColor = uiColor === "cream" ? null : uiColor;

    const changed =
      themeApplied &&
      (prevTheme !== nextTheme || (prevUiColor || null) !== nextUiColor);

    // Add the suppression class before mutating the attributes so the browser
    // batches the variable change and the "no transition" rule into one paint.
    if (changed) suppressThemeTransitions(html);

    html.setAttribute("data-theme", nextTheme);
    if (nextUiColor === null) html.removeAttribute("data-ui-color");
    else html.setAttribute("data-ui-color", nextUiColor);

    const rm = reduceMotion !== undefined ? reduceMotion : readReduceMotion();
    if (rm) html.setAttribute("data-reduce-motion", "1");
    else html.removeAttribute("data-reduce-motion");

    themeApplied = true;
  }

  function setTheme(theme, options) {
    const opts = options || {};
    if (opts.persistDevice !== false) {
      localStorage.setItem(DEVICE_KEY, theme);
    }
    const rm = opts.reduceMotion !== undefined ? opts.reduceMotion : readReduceMotion();
    apply(theme, rm);
  }

  apply(readTheme());

  global.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if (readTheme() === "system") apply("system");
  });

  global.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change", () => {
    apply(readTheme());
  });

  global.addEventListener("user-prefs-changed", () => {
    apply(readTheme());
  });

  global.SiteTheme = {
    get: readTheme,
    apply: setTheme,
    isReduceMotion() {
      return document.documentElement.getAttribute("data-reduce-motion") === "1";
    },
    DEVICE_KEY,
    PREFS_KEY,
  };
})(window);

/* Site-wide scroll progress bar · replaces the hidden main scrollbar. */
(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    if (!document.body || document.getElementById("scroll-progress")) return;

    const bar = document.createElement("div");
    bar.id = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    const fill = document.createElement("div");
    fill.id = "scroll-progress-fill";
    bar.appendChild(fill);
    document.body.appendChild(bar);

    let ticking = false;

    function compute() {
      ticking = false;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const max = (doc.scrollHeight || 0) - (doc.clientHeight || 0);
      const pct = max > 1 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
      fill.style.transform = "scaleX(" + pct + ")";
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(compute);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    window.addEventListener("load", compute);
    window.addEventListener("site-unlocked", compute);
    compute();
  });
})();
