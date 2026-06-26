/**
 * Floating Sign out control · fixed top-right, does not affect page layout.
 */
(function (global) {
  const UNLOCK_KEY = "lpc_site_unlock";

  function shouldShow() {
    if (global.UserPrefs?.showSignOutFloat?.() === false) return false;
    if (global.SiteLock?.isAuthenticated) return global.SiteLock.isAuthenticated();
    if (global.document.body?.dataset?.public === "1") return false;
    if (sessionStorage.getItem(UNLOCK_KEY) !== "1") return false;
    return !!global.RepSession?.get?.();
  }

  function update() {
    const existing = document.getElementById("sign-out-float");
    if (!shouldShow()) {
      existing?.remove();
      return;
    }
    if (existing) return;

    const btn = document.createElement("button");
    btn.id = "sign-out-float";
    btn.type = "button";
    btn.className = "sign-out-float";
    btn.textContent = "Sign out";
    btn.setAttribute("aria-label", "Sign out");
    btn.addEventListener("click", () => global.RepSession?.signOut?.());
    document.body.appendChild(btn);
  }

  function init() {
    update();
    global.addEventListener("site-unlocked", update);
    global.addEventListener("site-locked", update);
    global.addEventListener("rep-session-changed", update);
    global.addEventListener("user-prefs-changed", update);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.SignOutFloat = { update };
})(window);
