/**
 * Shared "called" status — Supabase when configured, else localStorage.
 */
(function (global) {
  const STATUS_KEY = "lpc_leads_status_v1";
  const TRACKER_KEY = "lpc_sales_tracker_v2";

  let mode = "local";
  let client = null;
  let channel = null;
  let onUpdate = null;
  let realtimeTimer = null;
  let lastMapJson = "";

  function workflowKey() {
    const id = global.RepSession?.get?.()?.id || "anon";
    return "lpc_lead_workflow_" + id + "_v1";
  }

  function loadWorkflowOverlay() {
    try {
      return JSON.parse(localStorage.getItem(workflowKey()) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveWorkflowOverlay(overlay) {
    localStorage.setItem(workflowKey(), JSON.stringify(overlay || {}));
  }

  function saveWorkflowOverlayEntry(leadId, workflow) {
    const overlay = loadWorkflowOverlay();
    const w = String(workflow || "").trim();
    if (!w) {
      delete overlay[leadId];
    } else {
      overlay[leadId] = {
        workflow: w,
        called: w === "complete",
      };
    }
    saveWorkflowOverlay(overlay);
  }

  function applyWorkflow(map, leadId, workflow, businessName) {
    const next = { ...(map || {}) };
    let w = String(workflow || "").trim();
    if (w === "active") w = "";
    if (w === "removed") {
      next[leadId] = { workflow: "removed", called: false };
    } else if (w === "pending") {
      next[leadId] = { workflow: "pending", called: false };
    } else if (w === "flagged") {
      next[leadId] = { workflow: "flagged", called: false };
    } else if (w === "complete") {
      next[leadId] = {
        workflow: "complete",
        called: true,
        calledBy: getRepName(),
        calledAt: new Date().toISOString(),
      };
    } else {
      delete next[leadId];
    }
    if (businessName && next[leadId]) {
      next[leadId].businessName = String(businessName).trim();
    }
    return next;
  }

  function mergeWorkflow(map) {
    const overlay = loadWorkflowOverlay();
    Object.keys(overlay).forEach((id) => {
      map[id] = { ...(map[id] || {}), ...overlay[id] };
    });
    return map;
  }

  function mapSignature(map) {
    const keys = Object.keys(map || {}).sort();
    const parts = keys.map((id) => {
      const s = map[id] || {};
      const w = s.workflow || (s.called ? "complete" : "");
      return id + ":" + w + ":" + (s.called ? "1" : "0");
    });
    return parts.join("|");
  }

  function normalizeEntry(entry) {
    const workflow = entry?.workflow || (entry?.called ? "complete" : "");
    const called = workflow === "complete" || !!entry?.called;
    return {
      ...entry,
      workflow: workflow || (called ? "complete" : ""),
      called,
    };
  }

  function emitUpdate(map, meta) {
    if (!onUpdate) return;
    const sig = mapSignature(map);
    if (sig === lastMapJson) return;
    lastMapJson = sig;
    onUpdate(map, meta);
  }

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function canUseTeam() {
    const { url, key } = cfg();
    return !!(url && key && global.supabase?.createClient);
  }

  function getRepName() {
    const fromPin = global.RepSession?.getName?.();
    if (fromPin) return fromPin;
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(TRACKER_KEY)
        : localStorage.getItem(TRACKER_KEY);
      const data = JSON.parse(raw || "{}");
      return String(data.name || "").trim() || "Rep";
    } catch (e) {
      return "Rep";
    }
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveLocal(map) {
    localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  }

  function rowsToMap(rows) {
    const map = {};
    (rows || []).forEach((row) => {
      map[row.lead_id] = normalizeEntry({
        called: !!row.called,
        workflow: row.called ? "complete" : "",
        calledBy: row.called_by || "",
        calledAt: row.called_at || "",
      });
    });
    return mergeWorkflow(map);
  }

  async function fetchTeam() {
    const { data, error } = await client
      .from("lead_status")
      .select("lead_id,business_name,called,called_by,called_at");
    if (error) throw error;
    return rowsToMap(data);
  }

  async function upsertTeam(leadId, called, businessName) {
    const row = {
      lead_id: leadId,
      called: !!called,
      called_by: called ? getRepName() : null,
      called_at: called ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const name = String(businessName || "").trim();
    if (name) row.business_name = name;
    const { error } = await client.from("lead_status").upsert(row, { onConflict: "lead_id" });
    if (error) throw error;
  }

  async function migrateLocalToTeam() {
    const local = loadLocal();
    const ids = Object.keys(local).filter((id) => local[id]?.called);
    if (!ids.length) return;
    for (const id of ids) {
      try {
        await upsertTeam(id, true, local[id]?.businessName);
      } catch (e) {
        console.warn("Lead sync migrate:", id, e);
      }
    }
    localStorage.removeItem(STATUS_KEY);
  }

  function subscribeTeam() {
    if (!client || channel) return;
    if (global.SITE_CONFIG?.useLeadStatusRealtime === false) return;
    channel = client
      .channel("lead_status_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_status" },
        () => {
          clearTimeout(realtimeTimer);
          realtimeTimer = setTimeout(async () => {
            try {
              const map = await fetchTeam();
              emitUpdate(map, { mode: "team", source: "realtime" });
            } catch (e) {
              console.warn("Lead sync realtime refresh failed", e);
            }
          }, 800);
        }
      )
      .subscribe();
  }

  async function init(callback) {
    onUpdate = callback;

    if (!canUseTeam()) {
      mode = "local";
      emitUpdate(mergeWorkflow(loadLocal()), { mode: "local" });
      return {
        mode: "local",
        async setWorkflow(leadId, workflow, businessName) {
          let map = {};
          Object.entries(loadLocal()).forEach(([id, entry]) => {
            map[id] = normalizeEntry(entry);
          });
          map = applyWorkflow(map, leadId, workflow, businessName);
          const persist = {};
          Object.entries(map).forEach(([id, entry]) => {
            if (
              entry.workflow === "removed" ||
              entry.workflow === "flagged" ||
              entry.workflow === "pending"
            ) {
              persist[id] = entry;
            } else if (entry.called) {
              persist[id] = entry;
            }
          });
          saveLocal(persist);
          saveWorkflowOverlayEntry(leadId, workflow === "complete" ? "" : workflow);
          emitUpdate(mergeWorkflow(map), { mode: "local" });
        },
        async setCalled(leadId, called, businessName) {
          return this.setWorkflow(leadId, called ? "complete" : "", businessName);
        },
      };
    }

    try {
      const { url, key } = cfg();
      client = global.supabase.createClient(url, key);
      mode = "team";

      await migrateLocalToTeam();
      const map = await fetchTeam();
      emitUpdate(map, { mode: "team" });
      subscribeTeam();

      return {
        mode: "team",
        async setWorkflow(leadId, workflow, businessName) {
          if (!workflow || workflow === "active") {
            await upsertTeam(leadId, false, businessName);
            saveWorkflowOverlayEntry(leadId, "");
          } else if (workflow === "complete") {
            await upsertTeam(leadId, true, businessName);
            saveWorkflowOverlayEntry(leadId, "");
          } else if (workflow === "pending") {
            await upsertTeam(leadId, false, businessName);
            saveWorkflowOverlayEntry(leadId, "pending");
          } else {
            await upsertTeam(leadId, false, businessName);
            saveWorkflowOverlayEntry(leadId, workflow);
          }
          const next = await fetchTeam();
          emitUpdate(next, { mode: "team" });
        },
        async setCalled(leadId, called, businessName) {
          return this.setWorkflow(leadId, called ? "complete" : "pending", businessName);
        },
      };
    } catch (e) {
      console.error("LeadSync: could not connect, using this device only", e);
      mode = "local";
      const map = loadLocal();
      emitUpdate(map, { mode: "local", error: true });
      return {
        mode: "local",
        async setWorkflow(leadId, workflow, businessName) {
          let map = {};
          Object.entries(loadLocal()).forEach(([id, entry]) => {
            map[id] = normalizeEntry(entry);
          });
          map = applyWorkflow(map, leadId, workflow, businessName);
          const persist = {};
          Object.entries(map).forEach(([id, entry]) => {
            if (entry.workflow === "removed" || entry.workflow === "flagged" || entry.workflow === "pending") {
              persist[id] = entry;
            } else if (entry.called) {
              persist[id] = entry;
            }
          });
          saveLocal(persist);
          emitUpdate(mergeWorkflow(map), { mode: "local" });
        },
        async setCalled(leadId, called, businessName) {
          return this.setWorkflow(leadId, called ? "complete" : "pending", businessName);
        },
      };
    }
  }

  function getMode() {
    return mode;
  }

  function isConfigured() {
    return canUseTeam();
  }

  global.LeadSync = { init, getMode, isConfigured };
})(window);
