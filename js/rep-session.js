/**
 * Current rep for this browser session (set by PIN on lock screen).
 */
(function (global) {
  const STORAGE_KEY = "lpc_rep_session_v1";
  const TRACKER_KEY = "lpc_sales_tracker_v2";

  function get() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!o?.id || !o?.name) return null;
      return { id: String(o.id), name: String(o.name) };
    } catch (e) {
      return null;
    }
  }

  function set(rep) {
    if (!rep?.id || !rep?.name) return;
    const prev = get();
    const next = { id: String(rep.id), name: String(rep.name).trim() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    applyToTracker(true);
    if (prev?.id && prev.id !== next.id && global.RepStorage?.resetForRep) {
      global.RepStorage.resetForRep();
    }
    global.dispatchEvent(new CustomEvent("rep-session-changed", { detail: next }));
  }

  function clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function signOut() {
    clear();
    sessionStorage.removeItem("lpc_site_unlock");
    if (global.RepStorage?.resetForRep) global.RepStorage.resetForRep();
    window.location.reload();
  }

  function getName() {
    return get()?.name || "";
  }

  function loadTrackerRaw() {
    if (window.RepStorage?.loadItem) return window.RepStorage.loadItem(TRACKER_KEY);
    return localStorage.getItem(TRACKER_KEY);
  }

  function saveTrackerRaw(json) {
    if (window.RepStorage?.saveItem) window.RepStorage.saveItem(TRACKER_KEY, json);
    else localStorage.setItem(TRACKER_KEY, json);
  }

  function applyToTracker(force) {
    const session = get();
    if (!session?.name) return;
    try {
      const data = JSON.parse(loadTrackerRaw() || "{}");
      if (session.id && data.repId && data.repId !== session.id) {
        enforceTrackerIdentity();
        return;
      }
      data.repId = session.id;
      data.name = session.name;
      saveTrackerRaw(JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  /** Keep dashboard tracker tied to the rep who entered their PIN. */
  function enforceTrackerIdentity() {
    const session = get();
    if (!session?.id) return;
    const DEFAULT_GOAL = 2000;
    try {
      let data = JSON.parse(loadTrackerRaw() || "{}");
      if (!data || typeof data !== "object") data = {};

      if (data.repId && data.repId !== session.id) {
        data = {
          repId: session.id,
          name: session.name,
          goal: DEFAULT_GOAL,
          leadsPosted: 0,
          deals: [],
        };
      } else {
        data.repId = session.id;
        data.name = session.name;
        if (!data.goal || Number(data.goal) <= 0) data.goal = DEFAULT_GOAL;
        if (!Array.isArray(data.deals)) data.deals = [];
      }

      saveTrackerRaw(JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  }

  global.RepSession = {
    get,
    set,
    clear,
    signOut,
    getName,
    applyToTracker,
    enforceTrackerIdentity,
    STORAGE_KEY,
  };
})(window);
