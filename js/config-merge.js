/**
 * Merges gitignored js/private-config.js into SITE_CONFIG.
 * Loaded after config.js and private-config.js on every page.
 */
(function () {
  const pub = window.SITE_CONFIG || {};
  const priv = window.SITE_PRIVATE || {};

  const url = String(priv.supabaseUrl || pub.supabaseUrl || "").trim();
  const key = String(priv.supabaseAnonKey || pub.supabaseAnonKey || "").trim();
  const reps = Array.isArray(priv.reps) ? priv.reps : Array.isArray(pub.reps) ? pub.reps : [];

  window.SITE_CONFIG = Object.assign({}, pub, priv, {
    supabaseUrl: url,
    supabaseAnonKey: key,
    reps: reps
      .map((r) => ({
        id: String(r.id || "").trim(),
        name: String(r.name || "").trim(),
        pin: String(r.pin || "").trim(),
      }))
      .filter((r) => r.id && r.name && r.pin),
  });

  delete window.SITE_PRIVATE;
})();
