/**
 * Load leads from Supabase `leads` table (raw Google CSV columns).
 * Only businesses without a website (empty "lcr4fd href") are returned.
 */
(function (global) {
  const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
  const ADDRESS_RE = /\b\d{1,6}\s+[A-Za-z0-9]/;

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

  function cellValues(row) {
    const skip = new Set(["id", "imported_at", "has_website"]);
    const out = [];
    for (const [k, v] of Object.entries(row)) {
      if (skip.has(k)) continue;
      const s = String(v ?? "").trim();
      if (!s || s === "·") continue;
      out.push(s);
    }
    return out;
  }

  function parseRating(text) {
    const t = String(text || "").trim();
    const m = t.match(/(\d+(?:\.\d+)?)\s*\((\d+)\)/);
    if (m) return { rating: Number(m[1]), reviews: Number(m[2]) };
    const m2 = t.match(/^(\d+(?:\.\d+)?)$/);
    if (m2) return { rating: Number(m2[1]), reviews: null };
    const m3 = t.match(/\((\d+)\)/);
    if (m3) return { rating: null, reviews: Number(m3[1]) };
    return { rating: null, reviews: null };
  }

  function rawRowToLead(row) {
    const mapsUrl = String(row["hfpxzc href"] || row.maps_url || "").trim();
    const name = String(row["qBF1Pd"] || row.name || "").trim();
    const lcr4fd = String(row["lcr4fd href"] || "").trim();
    const hasWebsite = row.has_website === true || lcr4fd !== "";
    const cells = cellValues(row);

    let rating = null;
    let reviewCount = null;
    for (const c of cells) {
      if (c.startsWith("http") || PHONE_RE.test(c)) continue;
      const p = parseRating(c);
      if (p.rating != null) rating = p.rating;
      if (p.reviews != null) reviewCount = p.reviews;
    }

    let phone = "";
    for (const c of cells) {
      if (PHONE_RE.test(c) && !c.startsWith("http")) {
        phone = c;
        break;
      }
    }

    let address = "";
    for (const c of cells) {
      const low = c.toLowerCase();
      if (low.startsWith("open") || low.startsWith("closed")) continue;
      if (PHONE_RE.test(c) || c.startsWith("http")) continue;
      if (ADDRESS_RE.test(c)) {
        address = c;
        break;
      }
    }

    let hours = "";
    const hoursParts = [];
    for (const c of cells) {
      const low = c.toLowerCase();
      if (low.startsWith("open") || low.startsWith("closed") || low.includes("closes") || low.includes("opens")) {
        hoursParts.push(c);
        if (hoursParts.length >= 2) break;
      }
    }
    hours = hoursParts.join(" · ");

    let category = String(row["W4Efsd"] || row.category || "").trim();
    if (!category || parseRating(category).rating != null) {
      category = "Local business";
    }

    let website = "";
    if (lcr4fd && (lcr4fd.startsWith("http://") || lcr4fd.startsWith("https://"))) {
      const low = lcr4fd.toLowerCase();
      if (!low.includes("google.com/maps") && !low.includes("gstatic.com")) {
        website = lcr4fd;
      }
    }

    return {
      id: row.id,
      name,
      category,
      categoryGroup: category,
      phone,
      address,
      mapsUrl,
      website,
      hours,
      hasWebsite,
      rating,
      reviewCount,
      dedupeKey: row.id || "",
      sources: [],
    };
  }

  function buildMeta(leads) {
    const categories = [
      ...new Set(leads.map((l) => l.categoryGroup || l.category || "Other")),
    ].sort();
    return {
      source: "supabase",
      total: leads.length,
      noWebsite: leads.filter((l) => !l.hasWebsite).length,
      withWebsite: leads.filter((l) => l.hasWebsite).length,
      categories,
    };
  }

  async function loadFromJson() {
    const res = await fetch("data/leads.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load leads.json");
    const data = await res.json();
    const leads = (data.leads || [])
      .map((l) => {
        const lead = { ...l };
        delete lead.called;
        return lead;
      })
      .filter((l) => !l.hasWebsite);
    return {
      meta: { ...(data.meta || {}), source: "json", total: leads.length, noWebsite: leads.length },
      leads,
    };
  }

  async function loadFromSupabase() {
    const { url, key } = cfg();
    if (!url || !key || !global.supabase?.createClient) {
      throw new Error(
        "Supabase not configured — add supabaseUrl and supabaseAnonKey in js/config.js"
      );
    }
    const client = global.supabase.createClient(url, key);
    const pageSize = 1000;
    let from = 0;
    const rows = [];
    for (;;) {
      const { data, error } = await client
        .from("leads")
        .select("*")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data?.length) break;
      rows.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    if (!rows.length) {
      throw new Error(
        "Leads table is empty — import google CSV into public.leads (Table Editor), then refresh"
      );
    }
    const leads = rows.map(rawRowToLead).sort((a, b) => {
      const g = (a.categoryGroup || "").localeCompare(b.categoryGroup || "");
      if (g) return g;
      return (a.name || "").localeCompare(b.name || "");
    });
    return { meta: buildMeta(leads), leads };
  }

  async function load() {
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

  global.LeadsLoader = {
    load,
    loadFromJson,
    loadFromSupabase,
    isDatabaseRequired,
  };
})(window);
