/**
 * Lead Builder → Supabase new_clients table.
 */
(function (global) {
  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
      enabled: c.useNewClients !== false,
    };
  }

  function canSubmit() {
    const { enabled } = cfg();
    return enabled && !!global.SiteSupabase?.canUse?.();
  }

  function getClient() {
    return canSubmit() ? global.SiteSupabase?.getClient?.() || null : null;
  }

  function rep() {
    return global.RepSession?.get?.() || null;
  }

  async function resolveRep() {
    let rNow = rep();
    if (!rNow?.id && global.RepIdentity?.resolveRepIdentity) {
      await global.RepIdentity.resolveRepIdentity();
      rNow = rep();
    }
    return rNow;
  }

  /**
   * @param {object} payload
   * @param {string} [payload.lead_id]
   * @param {string} payload.business_name
   * @param {string} [payload.price]
   * @param {string} [payload.google_maps]
   * @param {string} [payload.preference]
   * @param {string} [payload.phone]
   * @param {string} [payload.owner_name]
   */
  async function submitLead(payload) {
    if (!canSubmit()) {
      throw new Error("Lead Builder needs Supabase · run supabase-new-clients-setup.sql.");
    }

    const rNow = await resolveRep();
    if (!rNow?.id) {
      throw new Error("Sign in with your PIN before sending.");
    }

    const businessName = String(payload?.business_name || "").trim();
    if (!businessName) {
      throw new Error("Enter a business name before sending.");
    }

    const sb = getClient();
    if (!sb) {
      throw new Error("Supabase is not configured for Lead Builder.");
    }

    const row = {
      rep_id: String(rNow.id),
      rep_name: String(rNow.name || "").trim() || String(rNow.id),
      lead_id: String(payload?.lead_id || "").trim() || null,
      business_name: businessName,
      price: String(payload?.price || "").trim() || null,
      google_maps: String(payload?.google_maps || "").trim() || null,
      preference: String(payload?.preference || "").trim() || null,
      phone: String(payload?.phone || "").trim() || null,
      owner_name: String(payload?.owner_name || "").trim() || null,
    };

    const { error } = await sb.from("new_clients").insert(row);
    if (error) {
      const err = new Error(error.message || "Could not save lead. Try again.");
      err.cause = error;
      throw err;
    }

    return row;
  }

  global.LeadBuilderSubmit = {
    canSubmit,
    submitLead,
  };
})(window);
