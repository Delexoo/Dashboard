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

/* ==========================================================================
 * Modern select · site-wide
 * Upgrades native <select> menus into a consistent, modern dropdown so every
 * dropdown on the site shares the same look. The native <select> is kept in
 * the DOM (visually hidden) and stays the source of truth, so existing code
 * that reads `select.value` or listens for `change` keeps working.
 * ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  if (!doc || !window.MutationObserver) return;

  var CHEV =
    '<svg class="ui-select-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function shouldSkip(select) {
    if (!select || select.tagName !== "SELECT") return true;
    if (select.multiple || select.size > 1) return true;
    if (select.dataset.modern === "off") return true;
    if (select.dataset.modernEnhanced === "1") return true;
    // The dashboard sale-amount select has its own bespoke dropdown.
    if (
      select.id === "saleAmountSelect" ||
      select.classList.contains("dash-income-amount-select") ||
      select.classList.contains("dash-select-native")
    )
      return true;
    if (select.closest(".ui-select") || select.closest(".dash-select")) return true;
    return false;
  }

  function buildMenu(menu, select) {
    menu.innerHTML = "";
    Array.prototype.forEach.call(select.options, function (opt) {
      var item = doc.createElement("button");
      item.type = "button";
      item.className = "ui-select-option";
      item.setAttribute("role", "option");
      item.dataset.value = opt.value;
      item.textContent = opt.textContent;
      if (opt.disabled) {
        item.classList.add("is-disabled");
        item.setAttribute("aria-disabled", "true");
      }
      menu.appendChild(item);
    });
  }

  function enhance(select) {
    if (shouldSkip(select)) return;
    select.dataset.modernEnhanced = "1";

    var wrap = doc.createElement("div");
    wrap.className = "ui-select";

    var trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.className = "ui-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    var aria = select.getAttribute("aria-label");
    if (aria) trigger.setAttribute("aria-label", aria);
    trigger.innerHTML = '<span class="ui-select-label"></span>' + CHEV;

    var menu = doc.createElement("div");
    menu.className = "ui-select-menu";
    menu.setAttribute("role", "listbox");
    buildMenu(menu, select);

    var parent = select.parentNode;
    if (!parent) return;
    parent.insertBefore(wrap, select);
    wrap.appendChild(trigger);
    wrap.appendChild(menu);
    wrap.appendChild(select);
    select.classList.add("ui-select-native");

    var labelEl = trigger.querySelector(".ui-select-label");

    function syncTrigger() {
      var val = select.value;
      var selectedOpt = null;
      for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === val) {
          selectedOpt = select.options[i];
          break;
        }
      }
      var isPlaceholder = !val || (selectedOpt && selectedOpt.disabled);
      labelEl.textContent = selectedOpt
        ? selectedOpt.textContent
        : select.options[0]
          ? select.options[0].textContent
          : "";
      trigger.classList.toggle("is-placeholder", !!isPlaceholder);
      var opts = menu.querySelectorAll(".ui-select-option");
      Array.prototype.forEach.call(opts, function (o) {
        var active = o.dataset.value === val && !!val;
        o.classList.toggle("is-active", active);
        o.setAttribute("aria-selected", active ? "true" : "false");
      });
      var disabled = !!select.disabled;
      trigger.disabled = disabled;
      wrap.classList.toggle("is-disabled", disabled);
    }

    function setOpen(open) {
      if (open && select.disabled) return;
      wrap.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        doc.addEventListener("click", onDocClick, true);
        var active = menu.querySelector(".ui-select-option.is-active") ||
          menu.querySelector(".ui-select-option:not(.is-disabled)");
        if (active) {
          try {
            active.focus({ preventScroll: true });
          } catch (e) {
            active.focus();
          }
        }
      } else {
        doc.removeEventListener("click", onDocClick, true);
      }
    }

    function onDocClick(e) {
      if (!wrap.contains(e.target)) setOpen(false);
    }

    function isOpen() {
      return wrap.classList.contains("is-open");
    }

    function focusTrigger() {
      try {
        trigger.focus({ preventScroll: true });
      } catch (e) {
        trigger.focus();
      }
    }

    function choose(opt) {
      if (!opt || opt.classList.contains("is-disabled")) return;
      if (select.value !== opt.dataset.value) {
        select.value = opt.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      syncTrigger();
      setOpen(false);
      focusTrigger();
    }

    function moveFocus(dir) {
      var opts = Array.prototype.slice
        .call(menu.querySelectorAll(".ui-select-option"))
        .filter(function (o) {
          return !o.classList.contains("is-disabled");
        });
      if (!opts.length) return;
      var idx = opts.indexOf(doc.activeElement);
      idx = idx + dir;
      if (idx < 0) idx = opts.length - 1;
      if (idx >= opts.length) idx = 0;
      try {
        opts[idx].focus({ preventScroll: true });
      } catch (e) {
        opts[idx].focus();
      }
    }

    trigger.addEventListener("click", function () {
      setOpen(!isOpen());
    });
    trigger.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    });

    menu.addEventListener("click", function (e) {
      var opt = e.target.closest(".ui-select-option");
      if (opt) choose(opt);
    });
    menu.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveFocus(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocus(-1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(e.target.closest(".ui-select-option"));
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        focusTrigger();
      } else if (e.key === "Tab") {
        setOpen(false);
      }
    });

    select.addEventListener("change", syncTrigger);

    // Catch programmatic value changes (no native "change" event fires).
    try {
      var desc = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      );
      if (desc && desc.configurable && desc.get && desc.set) {
        Object.defineProperty(select, "value", {
          configurable: true,
          enumerable: desc.enumerable,
          get: function () {
            return desc.get.call(this);
          },
          set: function (v) {
            desc.set.call(this, v);
            syncTrigger();
          },
        });
      }
    } catch (e) {
      /* value interception unsupported · change listener still covers most */
    }

    // Rebuild when options are populated later or disabled toggles.
    var mo = new MutationObserver(function () {
      buildMenu(menu, select);
      syncTrigger();
    });
    mo.observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });

    syncTrigger();
  }

  function enhanceAll(root) {
    var scope = root && root.querySelectorAll ? root : doc;
    var list = scope.querySelectorAll("select");
    Array.prototype.forEach.call(list, enhance);
  }

  function init() {
    enhanceAll(doc);
    var observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (!node || node.nodeType !== 1) continue;
          if (node.tagName === "SELECT") enhance(node);
          else if (node.querySelectorAll) enhanceAll(node);
        }
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true });
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.ModernSelect = { enhance: enhance, enhanceAll: enhanceAll };
})();
