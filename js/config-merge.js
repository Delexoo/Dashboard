/**
 * Merges gitignored js/private-config.js into SITE_CONFIG.
 * Supabase URL/key only — PINs are verified server-side (verify_rep_pin RPC).
 */
(function () {
  const pub = window.SITE_CONFIG || {};
  const priv = window.SITE_PRIVATE || {};

  const url = String(priv.supabaseUrl || pub.supabaseUrl || "").trim();
  const key = String(priv.supabaseAnonKey || pub.supabaseAnonKey || "").trim();

  window.SITE_CONFIG = Object.assign({}, pub, priv, {
    supabaseUrl: url,
    supabaseAnonKey: key,
    reps: [],
  });

  delete window.SITE_PRIVATE;
})();
