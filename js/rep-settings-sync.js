/**
 * Per-rep settings synced to Supabase rep_settings.settings_json on login.
 * Includes: course/checklist progress, tracker, scripts, templates, UI prefs,
 * sidebar/nav, setup survey, Lead Finder prefs, saved leads, session meta,
 * payout local cache (rep_payouts table is the source of truth for payout links).
 */
(function (global) {
  const PROGRESS_KEY = "lpc_sales_onboarding_progress_v1";

  const SYNC_KEYS = [
    "lpc_call_scripts_edits_v1",
    "lpc_custom_scripts_v1",
    "lpc_outreach_edits_v1",
    "lpc_custom_outreach_v1",
    "lpc_sales_tracker_v2",
    "lpc_sales_tracker_v1",
    "lpc_sales_onboarding_progress_v1",
    "lpc_sales_onboarding_steps_v1",
    "lpc_nav_collapsed_v1",
    "lpc_sidebar_collapsed_v1",
    "lpc_sidebar_width_v1",
    "lpc_setup_survey_step_v1",
    "lpc_accounts_survey_step_v1",
    "lpc_preferences_survey_step_v1",
    "lpc_setup_survey_flow_v1",
    "lpc_template_builder_v1",
    "lpc_lead_finder_prefs_v1",
    "lpc_lead_workflow_v1",
    "lpc_pending_lead_builder_v1",
    "lpc_lead_saved_v1",
    "lpc_leads_status_v1",
    "lpc_user_prefs_v1",
    "lpc_rep_payout_v1",
    "lpc_rep_payouts_list_v1",
    "lpc_rep_session_meta_v1",
    "lpc_rep_profile_photo_v1",
  ];

  let client = null;
  let repId = null;
  let syncTimer = null;
  let realtimeChannel = null;
  let realtimePullTimer = null;
  let ready = false;
  let initPromise = null;
  let initRepId = null;
  let inInitOnce = false;
  let readyEventQueued = false;
  const readyWaiters = [];

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
      enabled: c.useRepSettingsSync !== false,
    };
  }

  function canSync() {
    const { enabled } = cfg();
    return enabled && !!global.SiteSupabase?.canUse?.();
  }

  function repKey(base) {
    const id = repId || global.RepSession?.get?.()?.id;
    return id ? "lpc_rep_" + id + "_" + base : base;
  }

  function legacyWorkflowKey() {
    const id = repId || global.RepSession?.get?.()?.id || "anon";
    return "lpc_lead_workflow_" + id + "_v1";
  }

  function loadItem(base) {
    return localStorage.getItem(repKey(base));
  }

  const FAST_SYNC_KEYS = new Set([
    "lpc_lead_workflow_v1",
    "lpc_sales_tracker_v2",
    "lpc_pending_lead_builder_v1",
  ]);

  function saveItem(base, value) {
    if (value === "" || value == null) {
      localStorage.removeItem(repKey(base));
    } else {
      localStorage.setItem(repKey(base), value);
    }
    scheduleSync(base);
  }

  function resetForRep() {
    initPromise = null;
    initRepId = null;
    ready = false;
    unsubscribeCloudChanges();
    client = null;
    repId = null;
    clearTimeout(syncTimer);
    syncTimer = null;
  }

  function clearSyncedLocalKeys() {
    SYNC_KEYS.forEach((base) => localStorage.removeItem(repKey(base)));
    localStorage.removeItem(legacyWorkflowKey());
    if (global.UserPrefs?.resetToDefaults) global.UserPrefs.resetToDefaults();
  }

  function migrateLegacyLocalKeys() {
    const legacy = localStorage.getItem(legacyWorkflowKey());
    if (legacy && loadItem("lpc_lead_workflow_v1") == null) {
      saveItem("lpc_lead_workflow_v1", legacy);
      localStorage.removeItem(legacyWorkflowKey);
    }
    const globalSidebar = localStorage.getItem("lpc_sidebar_collapsed_v1");
    if (globalSidebar != null && loadItem("lpc_sidebar_collapsed_v1") == null) {
      saveItem("lpc_sidebar_collapsed_v1", globalSidebar);
    }
  }

  function collectSettings() {
    const out = {};
    SYNC_KEYS.forEach((base) => {
      const raw = localStorage.getItem(repKey(base));
      if (raw == null || raw === "") return;
      try {
        out[base] = JSON.parse(raw);
      } catch (e) {
        out[base] = raw;
      }
    });
    return out;
  }

  function parseProgressObj(val) {
    if (val == null) return {};
    if (typeof val === "object" && !Array.isArray(val)) return { ...val };
    try {
      const parsed = JSON.parse(val);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function mergeProgressJson(cloudVal, localRaw) {
    const cloud = parseProgressObj(cloudVal);
    const local = parseProgressObj(localRaw);
    const merged = { ...cloud, ...local };
    const keys = new Set([...Object.keys(cloud), ...Object.keys(local)]);
    keys.forEach((k) => {
      if (cloud[k] || local[k]) merged[k] = true;
    });
    return JSON.stringify(merged);
  }

  function normalizeDeletedDealIds(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach((id) => {
      const s = String(id || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out;
  }

  function parseTrackerObj(val) {
    if (val == null || val === "") return { goal: 1000, deals: [], deletedDealIds: [] };
    try {
      const o = typeof val === "string" ? JSON.parse(val) : val;
      if (!o || typeof o !== "object") return { goal: 1000, deals: [], deletedDealIds: [] };
      return {
        repId: String(o.repId || ""),
        name: String(o.name || ""),
        goal: Number(o.goal) > 0 ? Number(o.goal) : 1000,
        leadsPosted: Number(o.leadsPosted) || 0,
        deals: Array.isArray(o.deals) ? o.deals : [],
        deletedDealIds: normalizeDeletedDealIds(o.deletedDealIds),
      };
    } catch (e) {
      return { goal: 1000, deals: [], deletedDealIds: [] };
    }
  }

  /** Union sales on refresh so cloud pull never drops locally logged deals; tombstones win on delete. */
  function mergeTrackerJson(cloudVal, localRaw) {
    const hasLocal = localRaw != null && String(localRaw).trim() !== "";
    const cloud = parseTrackerObj(cloudVal);
    const emptyLocal = {
      repId: "",
      name: "",
      goal: 0,
      leadsPosted: 0,
      deals: [],
      deletedDealIds: [],
    };
    const local = hasLocal ? parseTrackerObj(localRaw) : emptyLocal;
    const deletedDealIds = normalizeDeletedDealIds([
      ...cloud.deletedDealIds,
      ...local.deletedDealIds,
    ]);
    const deletedIds = new Set(deletedDealIds);
    const byId = new Map();

    cloud.deals.forEach((deal) => {
      const id = String(deal?.id || "").trim();
      if (!id || deletedIds.has(id)) return;
      byId.set(id, deal);
    });
    local.deals.forEach((deal) => {
      const id = String(deal?.id || "").trim();
      if (!id || deletedIds.has(id)) return;
      const existing = byId.get(id);
      if (existing?.fromOwnerConfirm) return;
      byId.set(id, deal);
    });

    const mergedDeals = [...byId.values()];
    const seenLoose = new Set();
    [...cloud.deals, ...local.deals].forEach((deal) => {
      const id = String(deal?.id || "").trim();
      if (id) return;
      const sig =
        String(deal?.createdAt || "") +
        "|" +
        String(deal?.commission || "") +
        "|" +
        String(deal?.businessName || "");
      if (seenLoose.has(sig)) return;
      seenLoose.add(sig);
      mergedDeals.push(deal);
    });

    mergedDeals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const goal =
      hasLocal && Number(local.goal) > 0
        ? local.goal
        : Number(cloud.goal) > 0
          ? cloud.goal
          : 1000;

    return JSON.stringify({
      repId: local.repId || cloud.repId || "",
      name: local.name || cloud.name || "",
      goal,
      leadsPosted: Math.max(local.leadsPosted, cloud.leadsPosted),
      deletedDealIds,
      deals: mergedDeals,
    });
  }

  function toIsoUtc(val) {
    if (!val) return new Date().toISOString();
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }

  function dealFromConfirmedClient(row) {
    const dealId = String(row?.tracker_deal_id || "").trim();
    if (!dealId) return null;
    return {
      id: dealId,
      createdAt: toIsoUtc(row.confirmed_at || row.created_at),
      commission: Number(row.commission_amount) || 0,
      saleAmount: Number(row.sale_amount) || 0,
      businessName: String(row.business_name || "").trim(),
      leadId: String(row.lead_id || "").trim(),
      fromOwnerConfirm: true,
      newClientId: String(row.id || "").trim(),
      repName: String(row.rep_name || "").trim(),
      submittedPrice: row.price || "",
      submittedPhone: row.phone || "",
      submittedOwnerName: row.owner_name || "",
      submittedPreference: row.preference || "",
      submittedGoogleMaps: row.google_maps || "",
      submittedAt: toIsoUtc(row.created_at),
    };
  }

  async function reconcileOwnerConfirmedSales() {
    if (!client || !repId) return false;
    const { data, error } = await client
      .from("new_clients")
      .select(
        "id, business_name, price, phone, owner_name, preference, google_maps, created_at, confirmed_at, sale_amount, commission_amount, tracker_deal_id, rep_name, lead_id"
      )
      .eq("rep_id", repId)
      .eq("sale_status", "confirmed")
      .not("tracker_deal_id", "is", null);
    if (error || !data?.length) return false;

    const tracker = parseTrackerObj(loadItem("lpc_sales_tracker_v2"));
    const deletedIds = new Set(tracker.deletedDealIds || []);
    const byId = new Map();
    (tracker.deals || []).forEach((deal) => {
      const id = String(deal?.id || "").trim();
      if (!id || deletedIds.has(id)) return;
      byId.set(id, deal);
    });

    let changed = false;
    data.forEach((row) => {
      const deal = dealFromConfirmedClient(row);
      if (!deal || byId.has(deal.id) || deletedIds.has(deal.id)) return;
      byId.set(deal.id, deal);
      changed = true;
    });

    if (!changed) return false;

    const merged = {
      ...tracker,
      repId: tracker.repId || repId,
      deals: [...byId.values()].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ),
    };
    localStorage.setItem(repKey("lpc_sales_tracker_v2"), JSON.stringify(merged));
    return true;
  }

  function unsubscribeCloudChanges() {
    if (realtimeChannel && client) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    clearTimeout(realtimePullTimer);
    realtimePullTimer = null;
  }

  function subscribeCloudChanges() {
    unsubscribeCloudChanges();
    if (!client || !repId) return;

    realtimeChannel = client
      .channel("rep-settings-sync-" + repId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rep_settings",
          filter: "rep_id=eq." + repId,
        },
        () => {
          clearTimeout(realtimePullTimer);
          realtimePullTimer = setTimeout(() => {
            pullCloud().catch((e) =>
              console.warn("Rep settings: realtime pull failed", e)
            );
          }, 320);
        }
      )
      .subscribe();
  }

  /** Keep the fresher online timestamp when cloud settings load on refresh. */
  function pickLatestIso(a, b) {
    const ta = a ? new Date(a).getTime() : NaN;
    const tb = b ? new Date(b).getTime() : NaN;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return "";
    if (Number.isNaN(ta)) return b;
    if (Number.isNaN(tb)) return a;
    return ta >= tb ? a : b;
  }

  /** Keep the fresher online timestamp when cloud settings load on refresh. */
  function mergeSessionMetaJson(cloudVal, localRaw) {
    let local = {};
    let cloud = cloudVal;
    try {
      local = localRaw ? JSON.parse(localRaw) : {};
    } catch (e) {
      local = {};
    }
    if (typeof cloud === "string") {
      try {
        cloud = JSON.parse(cloud);
      } catch (e) {
        cloud = {};
      }
    }
    if (!cloud || typeof cloud !== "object") cloud = {};

    const merged = { ...cloud, ...local };
    const lastOnlineAt = pickLatestIso(cloud.lastOnlineAt, local.lastOnlineAt);
    const lastLoginAt = pickLatestIso(cloud.lastLoginAt, local.lastLoginAt);
    if (lastOnlineAt) merged.lastOnlineAt = lastOnlineAt;
    if (lastLoginAt) merged.lastLoginAt = lastLoginAt;
    if (local.activeSince) merged.activeSince = local.activeSince;
    merged.activeMs = Math.max(Number(cloud.activeMs) || 0, Number(local.activeMs) || 0);
    merged.loginCount = Math.max(Number(cloud.loginCount) || 0, Number(local.loginCount) || 0);
    if (cloud.firstLoginAt && !merged.firstLoginAt) merged.firstLoginAt = cloud.firstLoginAt;
    return JSON.stringify(merged);
  }

  function isEmptyCloudSettings(obj) {
    return !obj || typeof obj !== "object" || Object.keys(obj).length === 0;
  }

  function applySettings(obj) {
    if (isEmptyCloudSettings(obj)) {
      return;
    }
    SYNC_KEYS.forEach((base) => {
      if (obj[base] === undefined) return;
      if (base === PROGRESS_KEY) {
        const localRaw = localStorage.getItem(repKey(base));
        localStorage.setItem(repKey(base), mergeProgressJson(obj[base], localRaw));
        return;
      }
      if (base === "lpc_sales_tracker_v2") {
        const localRaw = localStorage.getItem(repKey(base));
        localStorage.setItem(repKey(base), mergeTrackerJson(obj[base], localRaw));
        return;
      }
      if (base === "lpc_rep_session_meta_v1") {
        const localRaw = localStorage.getItem(repKey(base));
        localStorage.setItem(repKey(base), mergeSessionMetaJson(obj[base], localRaw));
        return;
      }
      if (base === "lpc_template_builder_v1") {
        const localRaw = localStorage.getItem(repKey(base));
        let local = {};
        try {
          local = localRaw ? JSON.parse(localRaw) : {};
        } catch (e) {
          local = {};
        }
        const cloud =
          obj[base] && typeof obj[base] === "object" ? obj[base] : {};
        const merged = { ...cloud, ...local };
        try {
          const pickRaw = global.sessionStorage?.getItem("lpc_lead_pick_v1");
          if (pickRaw) {
            const pick = JSON.parse(pickRaw);
            if (pick && typeof pick === "object") {
              if (pick.name) merged.name = String(pick.name).trim();
              if (pick.phone) merged.phone = String(pick.phone).trim();
              const maps = String(pick.mapsUrl || pick.maps || "").trim();
              if (maps) merged.maps = maps;
              if (pick.price) merged.price = String(pick.price).trim();
              if (pick.mode) merged.mode = pick.mode;
            }
          }
        } catch (e) {
          /* ignore */
        }
        if (!("phone" in local) && cloud.phone) merged.phone = cloud.phone;
        if (!("maps" in local) && cloud.maps) merged.maps = cloud.maps;
        if (!("name" in local) && cloud.name) merged.name = cloud.name;
        if (!("price" in local) && cloud.price) merged.price = cloud.price;
        if (!("mode" in local) && cloud.mode) merged.mode = cloud.mode;
        localStorage.setItem(repKey(base), JSON.stringify(merged));
        return;
      }
      const val =
        typeof obj[base] === "string" ? obj[base] : JSON.stringify(obj[base]);
      localStorage.setItem(repKey(base), val);
    });
  }

  async function pull() {
    if (!client || !repId) return false;
    const { data, error } = await client
      .from("rep_settings")
      .select("settings_json,rep_name")
      .eq("rep_id", repId)
      .maybeSingle();
    if (error) throw error;
    migrateLegacyLocalKeys();
    if (data?.settings_json) applySettings(data.settings_json);
    const repaired = await reconcileOwnerConfirmedSales();
    const cloudName = String(data?.rep_name || "").trim();
    if (cloudName && repId) {
      const session = global.RepSession?.get?.();
      if (!session?.name || session.name !== cloudName) {
        global.RepSession.set({ id: repId, name: cloudName });
      }
    }
    try {
      global.dispatchEvent(new Event("onboarding-progress-changed"));
    } catch (e) {
      /* ignore */
    }
    global.RepSession?.enforceTrackerIdentity?.();
    return repaired;
  }

  async function push() {
    if (!client || !repId) return;
    const settings_json = collectSettings();

    try {
      const { data } = await client
        .from("rep_settings")
        .select("settings_json")
        .eq("rep_id", repId)
        .maybeSingle();
      const cloudTracker = data?.settings_json?.lpc_sales_tracker_v2;
      const localRaw = localStorage.getItem(repKey("lpc_sales_tracker_v2"));
      if (cloudTracker !== undefined || localRaw != null) {
        settings_json.lpc_sales_tracker_v2 = JSON.parse(
          mergeTrackerJson(cloudTracker, localRaw)
        );
        localStorage.setItem(
          repKey("lpc_sales_tracker_v2"),
          JSON.stringify(settings_json.lpc_sales_tracker_v2)
        );
      }
    } catch (e) {
      console.warn("Rep settings: could not merge tracker before push", e);
    }

    const rep = global.RepSession?.get?.();
    const repName =
      String(rep?.name || "").trim() ||
      String(repId || "")
        .trim()
        .replace(/^\w/, (c) => c.toUpperCase());
    const row = {
      rep_id: repId,
      rep_name: repName || repId,
      settings_json,
      updated_at: new Date().toISOString(),
    };
    const { error } = await client
      .from("rep_settings")
      .upsert(row, { onConflict: "rep_id" });
    if (error) throw error;
    try {
      global.dispatchEvent(new Event("rep-settings-synced"));
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleSync(changedKey) {
    if (!client || !repId) return;
    clearTimeout(syncTimer);
    const delay = changedKey && FAST_SYNC_KEYS.has(changedKey) ? 280 : 550;
    syncTimer = setTimeout(() => {
      push().catch((e) => console.warn("Rep settings sync failed", e));
    }, delay);
  }

  async function flushSync() {
    if (!client || !repId) return push();
    clearTimeout(syncTimer);
    syncTimer = null;
    return push();
  }

  function flushReady() {
    ready = true;
    const list = readyWaiters.splice(0);
    list.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.warn(e);
      }
    });
    if (readyEventQueued) return;
    readyEventQueued = true;
    queueMicrotask(() => {
      readyEventQueued = false;
      try {
        global.dispatchEvent(new Event("rep-settings-ready"));
      } catch (e) {
        /* ignore */
      }
    });
  }

  function whenReady(fn) {
    if (ready) fn();
    else readyWaiters.push(fn);
  }

  async function init() {
    const currentId =
      global.RepSession?.getId?.() || global.RepSession?.get?.()?.id || null;
    if (initPromise && initRepId !== currentId) {
      resetForRep();
    }
    if (!initPromise) {
      initRepId = currentId;
      initPromise = initOnce();
    }
    return initPromise;
  }

  async function pullCloud() {
    if (!client || !repId) return;
    try {
      const repaired = await pull();
      global.RepSession?.touchOnline?.();
      scheduleSync(repaired ? "lpc_sales_tracker_v2" : undefined);
      try {
        global.dispatchEvent(new Event("rep-settings-pulled"));
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.warn("Rep settings: cloud pull failed, using this device", e);
    }
  }

  function getSyncClient() {
    return global.SiteSupabase?.getClient?.() || null;
  }

  async function initOnce() {
    if (inInitOnce) return initPromise;
    inInitOnce = true;
    ready = false;
    try {
      repId = global.RepSession?.getId?.() || global.RepSession?.get?.()?.id || null;
      initRepId = repId;
      global.RepSession?.enforceTrackerIdentity?.();
      migrateLegacyLocalKeys();

      if (!repId || !canSync()) {
        client = null;
        flushReady();
        return { mode: "local" };
      }

      try {
        client = getSyncClient();
        if (!client) {
          throw new Error("Supabase client unavailable");
        }
        flushReady();
        subscribeCloudChanges();
        void pullCloud();
        return { mode: "cloud" };
      } catch (e) {
        console.warn("Rep settings: cloud unavailable, using this device", e);
        client = null;
        flushReady();
        return { mode: "local", error: true };
      }
    } finally {
      inInitOnce = false;
    }
  }

  function isCloud() {
    return !!client && !!repId;
  }

  global.RepStorage = {
    SYNC_KEYS,
    key: repKey,
    loadItem,
    saveItem,
    clearSyncedLocalKeys,
    scheduleSync,
    flushSync,
    init,
    resetForRep,
    whenReady,
    isCloud,
    push,
  };
})(window);
