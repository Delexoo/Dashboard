/**
 * Per-rep UI preferences · synced via RepStorage.
 */
(function (global) {
  const PREFS_KEY = "lpc_user_prefs_v1";

  const DEFAULT_PREFS = {
    theme: "light",
    uiColor: "white",
    showCourseFullscreenHint: true,
    showSignOutFloat: true,
    reduceMotion: false,
    showGoalCelebration: true,
  };

  function loadRaw() {
    try {
      const raw = global.RepStorage?.loadItem?.(PREFS_KEY);
      if (!raw) return { ...DEFAULT_PREFS };
      const merged = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
      if (merged.uiColor === "current") merged.uiColor = "cream";
      return merged;
    } catch (e) {
      return { ...DEFAULT_PREFS };
    }
  }

  function save(prefs) {
    const merged = { ...DEFAULT_PREFS, ...prefs };
    const json = JSON.stringify(merged);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(PREFS_KEY, json);
    else {
      const id = global.RepSession?.get?.()?.id;
      const key = id ? "lpc_rep_" + id + "_" + PREFS_KEY : PREFS_KEY;
      localStorage.setItem(key, json);
    }
    if (global.SiteTheme) {
      global.SiteTheme.apply(merged.theme || "light", {
        persistDevice: true,
      });
      localStorage.setItem(global.SiteTheme.DEVICE_KEY, merged.theme || "light");
    }
    global.dispatchEvent(new Event("user-prefs-changed"));
  }

  function resetToDefaults() {
    save({ ...DEFAULT_PREFS });
  }

  function showCourseFullscreenHint() {
    return loadRaw().showCourseFullscreenHint !== false;
  }

  function showSignOutFloat() {
    return loadRaw().showSignOutFloat !== false;
  }

  function showGoalCelebration() {
    return loadRaw().showGoalCelebration !== false;
  }

  function forceReduceMotion() {
    return loadRaw().reduceMotion === true;
  }

  global.UserPrefs = {
    PREFS_KEY,
    DEFAULT_PREFS,
    get: loadRaw,
    save,
    resetToDefaults,
    showCourseFullscreenHint,
    showSignOutFloat,
    showGoalCelebration,
    forceReduceMotion,
  };
})(window);
