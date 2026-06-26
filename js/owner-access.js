/**
 * Site owner access (Delexo-only channels).
 */
(function (global) {
  function isSiteOwner() {
    const id = String(global.RepSession?.getId?.() || "").toLowerCase();
    const allowed = (global.SITE_CONFIG?.ownerRepIds || []).map((s) => String(s).toLowerCase());
    return !!id && allowed.includes(id);
  }

  function gateOwnerPage(fallback) {
    if (isSiteOwner()) return true;
    global.location.replace(fallback || "dashboard.html");
    return false;
  }

  global.SiteOwner = {
    isSiteOwner,
    gateOwnerPage,
  };
})(window);
