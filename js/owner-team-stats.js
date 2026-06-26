/**
 * Shared team stats from rep_settings (commission, sales, hours, activity).
 */
(function (global) {
  const META_KEY = "lpc_rep_session_meta_v1";
  const TRACKER_KEYS = ["lpc_sales_tracker_v2", "lpc_sales_tracker_v1"];

  let members = [];

  function defaultMember() {
    return {
      id: "",
      name: "",
      sales: 0,
      earned: 0,
      activeMs: 0,
      goal: 1000,
      lastOnlineAt: "",
      online: false,
    };
  }

  function formatMoney(n) {
    return Math.round(Number(n) || 0).toLocaleString();
  }

  function saleCountLabel(n) {
    const count = Number(n) || 0;
    return count === 1 ? "1 sale" : count + " sales";
  }

  function formatLifetimeHours(ms) {
    const hours = (Number(ms) || 0) / (1000 * 60 * 60);
    if (hours < 0.05) return "0 hrs";
    if (hours < 10) return hours.toFixed(1) + " hrs";
    return Math.round(hours).toLocaleString() + " hrs";
  }

  function metaFromSettings(settings) {
    const raw = settings?.[META_KEY];
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function activeMsFromMeta(meta) {
    if (!meta || typeof meta !== "object") return 0;
    let ms = Number(meta.activeMs) || 0;
    const since = meta.activeSince ? new Date(meta.activeSince).getTime() : NaN;
    if (!Number.isNaN(since)) ms += Math.max(0, Date.now() - since);
    return ms;
  }

  function trackerFromSettings(settings) {
    if (!settings || typeof settings !== "object") return null;
    for (let i = 0; i < TRACKER_KEYS.length; i++) {
      const raw = settings[TRACKER_KEYS[i]];
      if (raw == null) continue;
      if (typeof raw === "object") return raw;
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch (e) {
          /* ignore */
        }
      }
    }
    return null;
  }

  function formatLastOnline(iso) {
    if (!iso) return { label: "No activity yet", online: false };
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return { label: "No activity yet", online: false };
    const sec = Math.floor((Date.now() - then.getTime()) / 1000);
    if (sec < 120) return { label: "Online now", online: true };
    const min = Math.floor(sec / 60);
    if (min < 60) return { label: min === 1 ? "1 min ago" : min + " min ago", online: false };
    const hr = Math.floor(min / 60);
    if (hr < 24) return { label: hr === 1 ? "1 hr ago" : hr + " hr ago", online: false };
    const day = Math.floor(hr / 24);
    if (day < 7) return { label: day === 1 ? "1 day ago" : day + " days ago", online: false };
    return {
      label: then.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      online: false,
    };
  }

  function memberFromRow(row) {
    const id = String(row.rep_id || "").trim();
    const name = String(row.rep_name || "").trim() || id;
    const member = defaultMember();
    member.id = id;
    member.name = name;

    const meta = metaFromSettings(row.settings_json || {});
    member.activeMs = activeMsFromMeta(meta);
    member.lastOnlineAt = String(meta?.lastOnlineAt || meta?.lastLoginAt || "").trim();

    const tracker = trackerFromSettings(row.settings_json || {});
    const deals = Array.isArray(tracker?.deals) ? tracker.deals : [];
    member.sales = deals.length;
    member.earned = deals.reduce((sum, d) => sum + (Number(d.commission) || 0), 0);
    member.goal = Math.max(1, Number(tracker?.goal) || 1000);

    const last = formatLastOnline(member.lastOnlineAt);
    member.online = last.online;
    member.activityLabel = last.label;

    return member;
  }

  async function refresh(sb) {
    if (!sb) {
      members = [];
      return members;
    }

    try {
      const { data, error } = await sb
        .from("rep_settings")
        .select("rep_id, rep_name, settings_json");
      if (error) throw error;

      const seen = new Set();
      const next = [];

      (data || []).forEach((row) => {
        const id = String(row.rep_id || "").trim().toLowerCase();
        if (!id || seen.has(id)) return;
        seen.add(id);
        next.push(memberFromRow(row));
      });

      next.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
      members = next;
    } catch (e) {
      console.warn("Owner team stats: could not load", e);
      members = [];
    }

    return members;
  }

  function getMembers() {
    return members.slice();
  }

  function getTotals() {
    const totals = {
      goal: 0,
      earned: 0,
      sales: 0,
      activeMs: 0,
      contributors: members.length,
      onlineCount: 0,
    };

    members.forEach((member) => {
      totals.goal += member.goal || 0;
      totals.earned += member.earned || 0;
      totals.sales += member.sales || 0;
      totals.activeMs += member.activeMs || 0;
      if (member.online) totals.onlineCount += 1;
    });

    totals.goal = Math.max(1, totals.goal);
    totals.pct = Math.min(100, Math.round((totals.earned / totals.goal) * 100));
    return totals;
  }

  global.OwnerTeamStats = {
    refresh,
    getMembers,
    getTotals,
    formatMoney,
    formatLifetimeHours,
    saleCountLabel,
    formatLastOnline,
  };
})(window);
