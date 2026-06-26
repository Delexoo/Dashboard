(function () {
  const LEGAL_UPDATED = "2026-05-27";

  function cfg() {
    return window.SITE_CONFIG || {};
  }

  document.querySelectorAll("[data-config]").forEach((el) => {
    const key = el.dataset.config;
    const val = cfg()[key];
    if (!val) return;
    if (el.hasAttribute("data-config-text")) {
      el.textContent = val;
    } else if (el.tagName === "A") {
      if (key === "email") el.href = "mailto:" + val;
      else el.href = val;
      if (!/^https?:\/\//i.test(val)) {
        el.removeAttribute("target");
        el.removeAttribute("rel");
      }
    } else {
      el.textContent = val;
    }
  });

  const backBtn = document.getElementById("legal-back-btn");
  const backLabel = backBtn?.querySelector(".legal-page-back-label");
  const unlocked = sessionStorage.getItem("lpc_site_unlock") === "1";
  if (backBtn) {
    if (unlocked) {
      backBtn.href = "dashboard.html";
      if (backLabel) backLabel.textContent = "Back to dashboard";
    } else {
      backBtn.href = "setup.html";
      if (backLabel) backLabel.textContent = "Back to sign in";
    }
  }

  const page = document.body.dataset.page;
  document.querySelectorAll("[data-legal-nav]").forEach((el) => {
    el.classList.toggle("is-active", el.dataset.legalNav === page);
    if (el.dataset.legalNav === page) {
      el.setAttribute("aria-current", "page");
    } else {
      el.removeAttribute("aria-current");
    }
  });

  const timeEl = document.getElementById("legal-updated-date");
  if (timeEl) {
    try {
      const d = new Date(LEGAL_UPDATED + "T12:00:00");
      timeEl.dateTime = LEGAL_UPDATED;
      timeEl.textContent = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      timeEl.textContent = "May 27, 2026";
    }
  }
})();
