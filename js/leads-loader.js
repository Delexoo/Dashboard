/**
 * Load leads from Supabase `leads` table (raw Google CSV columns).
 * Only businesses without a website (empty "lcr4fd href") are returned.
 * Leads without a callable phone number are excluded from Lead Finder.
 */
(function (global) {
  const CACHE_KEY = "lpc_leads_cache_v4";
  const CACHE_TTL_MS = 12 * 60 * 1000;

  const LEAD_SELECT =
    'id,imported_at,"hfpxzc href","qBF1Pd","MW4etd","UY7F9","W4Efsd","W4Efsd 2","W4Efsd 3","W4Efsd 4","W4Efsd 5","W4Efsd 6","W4Efsd 7","UsdlK","lcr4fd href","Cw1rxd","R8c4Qb","Cw1rxd 2","R8c4Qb 2","doJOZc","Jn12ke src","ah5Ghc","ah5Ghc 2","ah5Ghc 3","e4rVHe"';

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
      useDatabase: c.useSupabaseLeads !== false,
    };
  }

  function isDatabaseRequired() {
    const { url, key, useDatabase } = cfg();
    return useDatabase && !!(url && key);
  }

  function hasCallablePhone(lead) {
    if (global.LeadDisplay?.hasCallablePhone) {
      return global.LeadDisplay.hasCallablePhone(lead);
    }
    const digits = String(lead?.phone || "").replace(/\D/g, "");
    return digits.length >= 10;
  }

  function rawRowToLead(row) {
    if (global.LeadCsvFormat?.parseRow) {
      return global.LeadCsvFormat.parseRow(row);
    }
    const mapsUrl = String(row["hfpxzc href"] || row.maps_url || row.mapsUrl || "").trim();
    const name = String(row["qBF1Pd"] || row.name || "").trim();
    const lcr4fd = String(row["lcr4fd href"] || row.website || "").trim();
    return {
      id: row.id,
      name,
      category: String(row["R8c4Qb 2"] || row.category || "Local business").trim(),
      categoryGroup: String(row["R8c4Qb 2"] || row.categoryGroup || "Local business").trim(),
      phone: String(row["UsdlK"] || row.phone || "").trim(),
      address: String(row["W4Efsd 2"] || row.address || "").trim(),
      mapsUrl,
      website: lcr4fd,
      hours: String(row["W4Efsd 3"] || row.hours || "").trim(),
      hasWebsite: row.has_website === true || lcr4fd !== "",
      rating: null,
      reviewCount: null,
      formatValid: false,
      formatError: "Format error",
      dedupeKey: row.id || "",
      sources: [],
    };
  }

  function finalizeLead(lead) {
    if (global.LeadDisplay?.sanitizeLeadFields) {
      return global.LeadDisplay.sanitizeLeadFields(lead);
    }
    return lead;
  }

  function filterBrowsableLeads(leads) {
    return (leads || []).filter((lead) => hasCallablePhone(lead));
  }

  function buildMeta(leads) {
    const validLeads = leads.filter((l) => l.formatValid !== false);
    const categories = [
      ...new Set(validLeads.map((l) => l.categoryGroup || l.category || "Other")),
    ].sort();
    return {
      source: "supabase",
      total: leads.length,
      valid: validLeads.length,
      invalid: leads.length - validLeads.length,
      noWebsite: leads.filter((l) => !l.hasWebsite).length,
      withWebsite: leads.filter((l) => l.hasWebsite).length,
      withPhone: leads.filter((l) => hasCallablePhone(l)).length,
      categories,
    };
  }

  function normalizeJsonLead(lead) {
    const row = { ...lead };
    if (!global.LeadCsvFormat?.parseRow) {
      return {
        ...lead,
        formatValid: false,
        formatError: "Format error",
      };
    }
    const parsed = global.LeadCsvFormat.parseRow(row);
    if (parsed.formatValid) return parsed;
    return {
      ...parsed,
      id: lead.id || parsed.id,
      dedupeKey: lead.dedupeKey || parsed.dedupeKey,
      sources: lead.sources || parsed.sources,
      formatValid: false,
      formatError: "Format error",
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!Array.isArray(o?.leads) || !o.leads.length) return null;
      const age = Date.now() - Number(o.cachedAt || 0);
      return {
        meta: o.meta || {},
        leads: o.leads,
        cachedAt: Number(o.cachedAt || 0),
        fresh: age >= 0 && age < CACHE_TTL_MS,
      };
    } catch (e) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          meta: payload.meta || {},
          leads: payload.leads || [],
          cachedAt: Date.now(),
        })
      );
    } catch (e) {
      /* ignore quota */
    }
  }

  function peekCache() {
    return readCache();
  }

  function clearCache() {
    try {
      sessionStorage.removeItem(CACHE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  async function loadFromJson() {
    const res = await fetch("data/leads.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load leads.json");
    const data = await res.json();
    const leads = filterBrowsableLeads(
      (data.leads || [])
        .map((l) => {
          const lead = normalizeJsonLead(l);
          delete lead.called;
          return finalizeLead(lead);
        })
    );
    const meta = {
      ...(data.meta || {}),
      source: "json",
      total: leads.length,
      noWebsite: leads.length,
      valid: leads.filter((l) => l.formatValid !== false).length,
      invalid: leads.filter((l) => l.formatValid === false).length,
      withPhone: leads.length,
    };
    writeCache({ meta, leads });
    return { meta, leads };
  }

  async function fetchLeadRows(client) {
    const pageSize = 1000;
    let from = 0;
    const rows = [];

    for (;;) {
      const { data, error } = await client
        .from("leads")
        .select(LEAD_SELECT)
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return rows;
  }

  async function loadFromSupabase() {
    const sb = global.SiteSupabase?.getClient?.() || null;
    if (!sb) {
      throw new Error(
        "Supabase not configured · add supabaseUrl and supabaseAnonKey in js/config.js"
      );
    }
    const rows = await fetchLeadRows(sb);
    if (!rows.length) {
      throw new Error(
        "Leads table is empty · import google CSV into public.leads (Table Editor), then refresh"
      );
    }
    const leads = filterBrowsableLeads(
      rows.map((row) => finalizeLead(rawRowToLead(row)))
    ).sort((a, b) => {
      const g = (a.categoryGroup || "").localeCompare(b.categoryGroup || "");
      if (g) return g;
      return (a.name || "").localeCompare(b.name || "");
    });
    const payload = { meta: buildMeta(leads), leads };
    writeCache(payload);
    return payload;
  }

  let refreshPromise = null;

  async function loadFromSource() {
    if (isDatabaseRequired()) {
      return loadFromSupabase();
    }
    const { useDatabase } = cfg();
    if (useDatabase) {
      throw new Error(
        "Leads are set to load from the database but Supabase keys are missing in js/config.js"
      );
    }
    return loadFromJson();
  }

  function scheduleBackgroundRefresh() {
    if (refreshPromise) return refreshPromise;
    refreshPromise = loadFromSource()
      .then((payload) => {
        try {
          global.dispatchEvent(new CustomEvent("leads-cache-refreshed", { detail: payload }));
        } catch (e) {
          /* ignore */
        }
        return payload;
      })
      .catch((e) => console.warn("Lead cache refresh failed", e))
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  }

  async function load(opts) {
    const options = opts && typeof opts === "object" ? opts : {};
    const cached = readCache();
    if (cached?.fresh && !options.force) {
      return { meta: cached.meta, leads: cached.leads, fromCache: true };
    }

    if (cached?.leads?.length && !options.force) {
      scheduleBackgroundRefresh();
      return { meta: cached.meta, leads: cached.leads, fromCache: true, stale: true };
    }

    return loadFromSource();
  }

  global.LeadsLoader = {
    load,
    loadFromJson,
    loadFromSupabase,
    isDatabaseRequired,
    peekCache,
    clearCache,
    hasCallablePhone,
  };
})(window);
