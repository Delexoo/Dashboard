/**
 * Per-rep UI preferences (theme, sidebar, motion) — synced via RepStorage.
 */
(function (global) {
  const PREFS_KEY = "lpc_user_prefs_v1";

  const DEFAULT_PREFS = {
    theme: "light",
    reduceMotion: false,
  };

  function loadRaw() {
    try {
      const raw = global.RepStorage?.loadItem?.(PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (e) {
      return { ...DEFAULT_PREFS };
    }
  }

  function save(prefs) {
    const json = JSON.stringify(prefs);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(PREFS_KEY, json);
    else {
      const id = global.RepSession?.get?.()?.id;
      const key = id ? "lpc_rep_" + id + "_" + PREFS_KEY : PREFS_KEY;
      localStorage.setItem(key, json);
    }
    if (global.SiteTheme) {
      global.SiteTheme.apply(prefs.theme || "light", {
        persistDevice: true,
        reduceMotion: !!prefs.reduceMotion,
      });
      localStorage.setItem(global.SiteTheme.DEVICE_KEY, prefs.theme || "light");
    }
    global.dispatchEvent(new Event("user-prefs-changed"));
  }

  global.UserPrefs = {
    PREFS_KEY,
    DEFAULT_PREFS,
    get: loadRaw,
    save,
  };
})(window);
