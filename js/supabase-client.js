/**
 * Shared Supabase browser client — one GoTrueClient per page.
 */
(function (global) {
  let client = null;

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function canUse() {
    const { url, key } = cfg();
    return !!(url && key && global.supabase?.createClient);
  }

  function getClient() {
    if (client) return client;
    if (!canUse()) return null;
    const { url, key } = cfg();
    client = global.supabase.createClient(url, key);
    return client;
  }

  global.SiteSupabase = { getClient, canUse };
})(window);
