/**
 * Post-login landing: dashboard when all course modules are done, else next course module.
 */
(function (global) {
  const PROGRESS_KEY = "lpc_sales_onboarding_progress_v1";

  function loadProgress() {
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(PROGRESS_KEY)
        : localStorage.getItem(PROGRESS_KEY);
      return JSON.parse(raw || "{}");
    } catch (e) {
      return {};
    }
  }

  function pageName() {
    const path = global.location.pathname || "";
    return path.split("/").pop().toLowerCase() || "index.html";
  }

  function isAtUrl(url) {
    const target = String(url || "").split("?")[0];
    const here = pageName();
    if (here === target) return true;
    if (!here && target === "index.html") return true;
    try {
      const full = new URL(url, global.location.href);
      const cur = new URL(global.location.href);
      return cur.pathname === full.pathname && cur.search === full.search;
    } catch (e) {
      return global.location.href.includes(url);
    }
  }

  function applyPostLoginRedirect() {
    const CM = global.CourseModules;
    if (!CM?.loginLandingUrl) return;

    const progress = loadProgress();
    const landing = CM.loginLandingUrl(progress);
    if (isAtUrl(landing)) return;

    if (CM.allComplete(progress)) {
      global.location.replace(landing);
      return;
    }

    const name = pageName();
    if (name === "index.html" || name === "course.html") {
      global.location.replace(landing);
    }
  }

  function runWhenStorageReady() {
    if (global.RepStorage?.whenReady) {
      global.RepStorage.whenReady(applyPostLoginRedirect);
    } else {
      applyPostLoginRedirect();
    }
  }

  function initEntryPage() {
    if (global.SiteLock?.whenUnlocked) {
      global.SiteLock.whenUnlocked(runWhenStorageReady);
    } else {
      runWhenStorageReady();
    }
  }

  global.LoginRedirect = {
    applyPostLoginRedirect: runWhenStorageReady,
  };

  if (document.documentElement.dataset.loginRedirect === "entry") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initEntryPage);
    } else {
      initEntryPage();
    }
  }
})(window);
