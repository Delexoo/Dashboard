/**
 * Owner Sales Console — sent leads inbox, confirm/dismiss RPCs, team tracker viewer.
 */
(function (global) {
  const REPS_URL = "data/reps.json";
  const COMMISSION_PRESET = { 500: 200, 700: 280, 1000: 400, 1500: 600 };
  const SALE_TIERS = [500, 700, 1000, 1500];
  const LEADS_QUERY_MS = 10000;
  const REPS_QUERY_MS = 8000;

  let leads = [];
  let filter = "pending";
  let reps = [];
  let selectedRepId = "";
  let realtimeChannel = null;
  let confirmTarget = null;
  let selectedSaleAmount = 700;
  let busy = false;
  let initStarted = false;
  let booted = false;
  let repTrackerSeq = 0;
  let repTrackerTimer = null;
  let teamTrackerAnimId = null;
  let teamRingPctShown = null;
  let viewingBannerDismissed = false;
  let teamDealsCache = [];
  let teamTrackerCache = null;
  let inboxSearchQuery = "";
  let inboxSuggestHideTimer = null;
  let deleteTarget = null;
  const LATER_LEADS_KEY = "owner_inbox_later_leads_v1";
  let laterLeadIds = loadLaterLeadIds();
  let notInterestedRows = [];
  let niRealtimeChannel = null;
  let niRefreshTimer = null;
  let ownerPanelHeightObserver = null;

  const LEADS_NI_SELECT =
    'id,"qBF1Pd","UsdlK","hfpxzc href","R8c4Qb","R8c4Qb 2","W4Efsd","W4Efsd 2","MW4etd","UY7F9","lcr4fd href"';

  function parseNiLeadRaw(row) {
    if (!row || typeof row !== "object") return null;
    if (global.LeadCsvFormat?.parseRow) {
      try {
        return global.LeadCsvFormat.parseRow(row);
      } catch (e) {
        /* fall through */
      }
    }
    return {
      id: String(row.id || "").trim(),
      name: String(row["qBF1Pd"] || "").trim(),
      phone: String(row["UsdlK"] || "").trim(),
      mapsUrl: String(row["hfpxzc href"] || "").trim(),
      category: String(row["R8c4Qb 2"] || row["R8c4Qb"] || "").trim(),
      categoryGroup: String(row["R8c4Qb 2"] || row["R8c4Qb"] || "").trim(),
      address: String(row["W4Efsd 2"] || row["W4Efsd"] || "").trim(),
      website: String(row["lcr4fd href"] || "").trim(),
      rating: Number(row["MW4etd"]) || null,
      reviewLabel: String(row["UY7F9"] || "").trim(),
    };
  }

  function formatNiPhone(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) {
      return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
    }
    if (digits.length === 11 && digits[0] === "1") {
      const d10 = digits.slice(1);
      return "(" + d10.slice(0, 3) + ") " + d10.slice(3, 6) + "-" + d10.slice(6);
    }
    return value;
  }

  function telHrefFromPhone(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 10) return "tel:+1" + digits;
    if (digits.length === 11 && digits[0] === "1") return "tel:+" + digits;
    return digits.length >= 7 ? "tel:+" + digits : "";
  }

  function formatNiRatingPlain(row) {
    const rating = Number(row.rating);
    const label = String(row.review_label || row.reviewLabel || "").trim();
    if (!Number.isFinite(rating) && !label) return "";
    const bits = [];
    if (Number.isFinite(rating) && rating > 0) bits.push(rating.toFixed(1));
    if (label) bits.push(label);
    return bits.join(" · ");
  }

  async function enrichNotInterestedRows(sb, rows) {
    const list = Array.isArray(rows) ? rows : [];
    const ids = [...new Set(list.map((r) => String(r.lead_id || "").trim()).filter(Boolean))];
    const byId = new Map();

    if (sb && ids.length) {
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const { data, error } = await sb.from("leads").select(LEADS_NI_SELECT).in("id", chunk);
        if (error) {
          console.warn("Owner console: could not enrich not-interested leads", error);
          break;
        }
        (data || []).forEach((raw) => {
          const lead = parseNiLeadRaw(raw);
          if (lead?.id) byId.set(String(lead.id), lead);
        });
      }
    }

    return list.map((row) => {
      const lead = byId.get(String(row.lead_id || "").trim());
      const phone = String(row.phone || lead?.phone || "").trim();
      const googleMaps = String(row.google_maps || lead?.mapsUrl || "").trim();
      const category = String(row.category || lead?.categoryGroup || lead?.category || "").trim();
      const address = String(row.address || lead?.address || "").trim();
      const website = String(lead?.website || "").trim();
      const businessName =
        String(row.business_name || lead?.name || "").trim() || String(row.lead_id || "Business");
      const rating =
        lead && Number.isFinite(Number(lead.rating)) ? Number(lead.rating) : null;
      const reviewLabel = String(lead?.reviewLabel || lead?.review_label || "").trim();
      return {
        ...row,
        business_name: businessName,
        phone,
        google_maps: googleMaps,
        category,
        address,
        website,
        rating,
        review_label: reviewLabel,
      };
    });
  }

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function commissionFromSale(amount) {
    const preset = COMMISSION_PRESET[amount];
    if (preset !== undefined) return preset;
    return Math.round(amount * 0.4);
  }

  function formatTimeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return "";
    const sec = Math.floor((Date.now() - then.getTime()) / 1000);
    if (sec < 45) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min === 1 ? "1 min ago" : min + " min ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? "1 hour ago" : hr + " hours ago";
    const day = Math.floor(hr / 24);
    if (day < 7) return day === 1 ? "1 day ago" : day + " days ago";
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function formatDealWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function repInitials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function canUseCloud() {
    return !!global.SiteSupabase?.canUse?.();
  }

  function getClient() {
    return global.SiteSupabase?.getClient?.() || null;
  }

  function withTimeout(promise, ms, label) {
    let timer = null;
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = global.setTimeout(() => {
          reject(new Error((label || "Request") + " timed out. Try a refresh."));
        }, ms);
      }),
    ]).finally(() => {
      if (timer) global.clearTimeout(timer);
    });
  }

  const LEAD_COLUMNS =
    "id, rep_id, rep_name, business_name, price, phone, owner_name, preference, google_maps, created_at, sale_status, sale_amount, commission_amount, lead_id";

  function statusLabel(status) {
    const s = String(status || "submitted").toLowerCase();
    if (s === "confirmed") return "Confirmed";
    if (s === "dismissed") return "Dismissed";
    return "Pending";
  }

  const GOAL_RING_R = 118;
  const GOAL_RING_C = 2 * Math.PI * GOAL_RING_R;

  function prefersReducedMotion() {
    return global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function parseMoneyText(text) {
    return Number(String(text || "").replace(/[^\d.-]/g, "")) || 0;
  }

  function parseIntStat(text) {
    return parseInt(String(text || "").replace(/[^\d]/g, ""), 10) || 0;
  }

  function cancelTeamTrackerAnim() {
    if (teamTrackerAnimId) {
      cancelAnimationFrame(teamTrackerAnimId);
      teamTrackerAnimId = null;
    }
  }

  function readTeamRingPct() {
    const ring = $("owner-progress-ring");
    if (!ring) return teamRingPctShown ?? 0;
    const off = parseFloat(ring.style.strokeDashoffset);
    if (!Number.isFinite(off)) return teamRingPctShown ?? 0;
    return Math.min(100, Math.max(0, (1 - off / GOAL_RING_C) * 100));
  }

  function applyTeamRingInstant(pct) {
    const ring = $("owner-progress-ring");
    if (!ring) return;
    const target = Math.min(100, Math.max(0, pct));
    ring.style.strokeDasharray = GOAL_RING_C + " " + GOAL_RING_C;
    ring.style.strokeDashoffset = String(GOAL_RING_C * (1 - target / 100));
    teamRingPctShown = target;
  }

  function triggerTeamRingBump() {
    const orbit = $("owner-progress-orbit");
    if (!orbit || prefersReducedMotion()) return;
    orbit.classList.remove("goal-progress-bump");
    void orbit.offsetWidth;
    orbit.classList.add("goal-progress-bump");
    const onEnd = () => {
      orbit.classList.remove("goal-progress-bump");
      orbit.removeEventListener("animationend", onEnd);
    };
    orbit.addEventListener("animationend", onEnd);
  }

  function animateTeamTracker(target) {
    const goalEl = $("owner-team-goal");
    const earnedEl = $("owner-team-earned");
    const salesEl = $("owner-team-sales");
    const progressEl = $("owner-team-progress");
    const ring = $("owner-progress-ring");

    const to = {
      goal: Math.max(1, Number(target.goal) || 1000),
      earned: Math.max(0, Number(target.earned) || 0),
      sales: Math.max(0, Number(target.sales) || 0),
      pct: Math.min(100, Math.max(0, Number(target.pct) || 0)),
    };

    cancelTeamTrackerAnim();

    const from = {
      goal: parseMoneyText(goalEl?.textContent),
      earned: parseMoneyText(earnedEl?.textContent),
      sales: parseIntStat(salesEl?.textContent),
      pct: readTeamRingPct(),
    };

    const snap =
      prefersReducedMotion() ||
      (from.goal === to.goal &&
        from.earned === to.earned &&
        from.sales === to.sales &&
        Math.abs(from.pct - to.pct) < 0.05);

    if (snap) {
      if (goalEl) goalEl.textContent = "$" + formatMoney(to.goal);
      if (earnedEl) earnedEl.textContent = "$" + formatMoney(to.earned);
      if (salesEl) salesEl.textContent = String(to.sales);
      if (progressEl) progressEl.textContent = Math.round(to.pct) + "%";
      applyTeamRingInstant(to.pct);
      return;
    }

    const decreasing = to.earned < from.earned - 0.5 || to.pct < from.pct - 0.05;
    const delta = Math.abs(to.pct - from.pct);
    const duration = decreasing
      ? Math.min(650, 280 + delta * 3)
      : Math.min(900, 500 + delta * 4);
    const startTime = performance.now();
    const targetOffset = GOAL_RING_C * (1 - to.pct / 100);
    const fromOffset = GOAL_RING_C * (1 - from.pct / 100);
    const bumpOnFinish = !decreasing && to.pct > from.pct + 0.05;

    if (ring) ring.style.strokeDasharray = GOAL_RING_C + " " + GOAL_RING_C;

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = decreasing ? easeOutCubic(t) : easeOutBack(t);

      const goal = Math.round(from.goal + (to.goal - from.goal) * eased);
      const earned = Math.round(from.earned + (to.earned - from.earned) * eased);
      const sales = Math.round(from.sales + (to.sales - from.sales) * eased);
      const pct = from.pct + (to.pct - from.pct) * eased;

      if (goalEl) goalEl.textContent = "$" + formatMoney(goal);
      if (earnedEl) earnedEl.textContent = "$" + formatMoney(earned);
      if (salesEl) salesEl.textContent = String(sales);
      if (progressEl) progressEl.textContent = Math.round(pct) + "%";
      if (ring) {
        ring.style.strokeDashoffset = String(
          fromOffset + (targetOffset - fromOffset) * eased
        );
      }

      if (t < 1) {
        teamTrackerAnimId = requestAnimationFrame(frame);
        return;
      }

      if (goalEl) goalEl.textContent = "$" + formatMoney(to.goal);
      if (earnedEl) earnedEl.textContent = "$" + formatMoney(to.earned);
      if (salesEl) salesEl.textContent = String(to.sales);
      if (progressEl) progressEl.textContent = Math.round(to.pct) + "%";
      applyTeamRingInstant(to.pct);
      teamTrackerAnimId = null;
      if (bumpOnFinish) triggerTeamRingBump();
    }

    teamTrackerAnimId = requestAnimationFrame(frame);
  }

  function statusClass(status) {
    const s = String(status || "submitted").toLowerCase();
    if (s === "confirmed") return "owner-console-status--confirmed";
    if (s === "dismissed") return "owner-console-status--dismissed";
    return "owner-console-status--pending";
  }

  function showTeamPanel() {
    const panel = $("owner-team-panel");
    const placeholder = $("owner-team-placeholder");
    if (!panel) return;
    placeholder?.setAttribute("hidden", "");
    panel.hidden = false;
    scheduleOwnerConsolePanelHeightSync();
  }

  function hideTeamPanel() {
    cancelTeamTrackerAnim();
    $("owner-team-panel")?.setAttribute("hidden", "");
    $("owner-team-placeholder")?.removeAttribute("hidden");
    scheduleOwnerConsolePanelHeightSync();
  }

  function repDisplayName(repId) {
    const id = String(repId || "").trim();
    if (!id) return "";
    const match = reps.find((r) => r.id.toLowerCase() === id.toLowerCase());
    return match?.name || id;
  }

  function canonicalRepId(repId) {
    const key = String(repId || "").trim().toLowerCase();
    if (!key) return "";
    const byId = reps.find((r) => r.id.toLowerCase() === key);
    if (byId) return byId.id;
    const byName = reps.find((r) => r.name.toLowerCase() === key);
    return byName?.id || String(repId).trim();
  }

  function showViewingBanner() {
    const banner = $("owner-viewing-banner");
    const text = $("owner-viewing-banner-text");
    if (!banner || !text) return;

    const viewingName = repDisplayName(selectedRepId);
    if (!viewingName) return;

    text.textContent = "Viewing " + viewingName + "'s dashboard";

    banner.removeAttribute("hidden");
    banner.setAttribute("aria-hidden", "false");
    banner.setAttribute("aria-label", "Dismiss · " + text.textContent);

    if (prefersReducedMotion()) {
      banner.classList.add("is-visible");
      return;
    }

    banner.classList.remove("is-visible");
    banner.classList.add("is-snapping");
    void banner.offsetHeight;
    banner.classList.remove("is-snapping");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.classList.add("is-visible");
      });
    });
  }

  function hideViewingBanner(animate) {
    const banner = $("owner-viewing-banner");
    if (!banner) return;
    if (!animate || prefersReducedMotion()) {
      banner.classList.remove("is-visible");
      banner.setAttribute("hidden", "");
      banner.setAttribute("aria-hidden", "true");
      return;
    }
    banner.classList.remove("is-visible");
    const onEnd = (e) => {
      if (e.target !== banner || e.propertyName !== "transform") return;
      banner.setAttribute("hidden", "");
      banner.setAttribute("aria-hidden", "true");
      banner.removeEventListener("transitionend", onEnd);
    };
    banner.addEventListener("transitionend", onEnd);
  }

  function updateViewingBanner() {
    const viewingName = repDisplayName(selectedRepId);

    if (!viewingName) {
      viewingBannerDismissed = false;
      hideViewingBanner(true);
      return;
    }

    if (viewingBannerDismissed) {
      hideViewingBanner(false);
      return;
    }

    showViewingBanner();
  }

  function getPendingRepSuggestions(query) {
    const q = String(query || "").trim().toLowerCase();
    const map = new Map();

    leads.forEach((row) => {
      const status = String(row.sale_status || "submitted").toLowerCase();
      if (status !== "submitted") return;

      const repName = String(row.rep_name || row.rep_id || "").trim();
      if (!repName) return;

      const key = repName.toLowerCase();
      if (map.has(key)) return;

      const repId = String(row.rep_id || "").toLowerCase();
      if (q && !repName.toLowerCase().includes(q) && !repId.includes(q)) return;

      map.set(key, { name: repName });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  function syncInboxSearchUi() {
    const input = $("owner-inbox-search");
    const clearBtn = $("owner-inbox-search-clear");
    if (!input) return;

    const hasValue = String(input.value || "").trim().length > 0;
    clearBtn?.toggleAttribute("hidden", !hasValue);
    input.setAttribute("aria-expanded", input === document.activeElement && !($("owner-inbox-search-suggestions")?.hidden) ? "true" : "false");
  }

  function hideInboxSearchSuggestions() {
    const list = $("owner-inbox-search-suggestions");
    if (!list) return;
    list.hidden = true;
    list.innerHTML = "";
    syncInboxSearchUi();
  }

  function showInboxSearchSuggestions() {
    const list = $("owner-inbox-search-suggestions");
    const input = $("owner-inbox-search");
    if (!list || !input) return;

    const suggestions = getPendingRepSuggestions(input.value || inboxSearchQuery);
    if (!suggestions.length) {
      hideInboxSearchSuggestions();
      return;
    }

    list.hidden = false;
    list.innerHTML = suggestions
      .map(
        (item) =>
          '<li role="presentation">' +
          '<button type="button" class="owner-console-inbox-search-suggestion" role="option" data-inbox-suggest="' +
          esc(item.name) +
          '">' +
          esc(item.name) +
          "</button>" +
          "</li>"
      )
      .join("");

    if (global.SiteIcons?.initIcons) global.SiteIcons.initIcons(list);
    syncInboxSearchUi();
  }

  function setInboxSearchQuery(value, opts) {
    const options = opts || {};
    inboxSearchQuery = String(value || "");
    const input = $("owner-inbox-search");
    if (input && input.value !== inboxSearchQuery) {
      input.value = inboxSearchQuery;
    }
    syncInboxSearchUi();
    if (options.hideSuggestions) {
      hideInboxSearchSuggestions();
    }
    renderInbox();
    if (!options.hideSuggestions && options.showSuggestions) {
      showInboxSearchSuggestions();
    }
  }

  function bindInboxSearch() {
    const input = $("owner-inbox-search");
    const clearBtn = $("owner-inbox-search-clear");
    const suggestions = $("owner-inbox-search-suggestions");
    const field = document.querySelector(".owner-console-inbox-search-field");
    if (!input || input.dataset.bound === "1") return;
    input.dataset.bound = "1";

    if (global.SiteIcons?.initIcons && clearBtn) {
      global.SiteIcons.initIcons(clearBtn);
    }

    input.addEventListener("input", (e) => {
      setInboxSearchQuery(e.target.value, { showSuggestions: true });
    });

    input.addEventListener("focus", () => {
      clearTimeout(inboxSuggestHideTimer);
      showInboxSearchSuggestions();
    });

    input.addEventListener("click", () => {
      clearTimeout(inboxSuggestHideTimer);
      showInboxSearchSuggestions();
    });

    input.addEventListener("blur", () => {
      clearTimeout(inboxSuggestHideTimer);
      inboxSuggestHideTimer = setTimeout(() => {
        hideInboxSearchSuggestions();
      }, 140);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      hideInboxSearchSuggestions();
      input.blur();
    });

    clearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      setInboxSearchQuery("", { showSuggestions: true });
      input.focus();
    });

    suggestions?.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    suggestions?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-inbox-suggest]");
      if (!btn) return;
      setInboxSearchQuery(btn.getAttribute("data-inbox-suggest") || "", { hideSuggestions: true });
      input.focus();
    });

    document.addEventListener("click", (e) => {
      if (field?.contains(e.target)) return;
      hideInboxSearchSuggestions();
    });
  }

  function loadLaterLeadIds() {
    try {
      const raw = global.localStorage?.getItem(LATER_LEADS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      return [];
    }
  }

  function saveLaterLeadIds() {
    try {
      global.localStorage?.setItem(LATER_LEADS_KEY, JSON.stringify(laterLeadIds));
    } catch (_) {}
  }

  function pruneLaterLeadIds() {
    const pendingIds = new Set(
      leads
        .filter((l) => String(l.sale_status || "submitted").toLowerCase() === "submitted")
        .map((l) => String(l.id))
    );
    const next = laterLeadIds.filter((id) => pendingIds.has(id));
    if (next.length !== laterLeadIds.length) {
      laterLeadIds = next;
      saveLaterLeadIds();
    }
  }

  function removeLaterLeadId(id) {
    const sid = String(id || "");
    if (!sid) return;
    const next = laterLeadIds.filter((x) => x !== sid);
    if (next.length === laterLeadIds.length) return;
    laterLeadIds = next;
    saveLaterLeadIds();
  }

  function sortLeadsWithLater(rows) {
    if (!laterLeadIds.length) return rows;

    const laterSet = new Set(laterLeadIds);
    const normal = [];
    const later = [];

    rows.forEach((row) => {
      if (laterSet.has(String(row.id))) later.push(row);
      else normal.push(row);
    });

    later.sort(
      (a, b) =>
        laterLeadIds.indexOf(String(a.id)) - laterLeadIds.indexOf(String(b.id))
    );

    return normal.concat(later);
  }

  function laterLead(id) {
    const sid = String(id || "").trim();
    if (!sid || busy) return;

    const row = leads.find((l) => String(l.id) === sid);
    if (!row) return;
    if (String(row.sale_status || "submitted").toLowerCase() !== "submitted") return;

    laterLeadIds = laterLeadIds.filter((x) => x !== sid);
    laterLeadIds.push(sid);
    saveLaterLeadIds();
    renderInbox();
    setInboxStatus('Moved "' + (row.business_name || "lead") + '" to the bottom of the list.');
  }

  function filterLeads() {
    let rows;
    if (filter === "pending") {
      rows = leads.filter((l) => {
        const s = String(l.sale_status || "submitted").toLowerCase();
        return s === "submitted";
      });
    } else if (filter === "confirmed") {
      rows = leads.filter((l) => String(l.sale_status || "").toLowerCase() === "confirmed");
    } else {
      rows = leads.slice();
    }

    const q = String(inboxSearchQuery || "").trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => {
        const haystack = [
          row.business_name,
          row.rep_name,
          row.rep_id,
          row.phone,
          row.owner_name,
          row.price,
          row.preference,
          row.google_maps,
          row.lead_id,
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        return haystack.includes(q);
      });
    }

    return sortLeadsWithLater(rows);
  }

  function setInboxStatus(msg, isError) {
    const el = $("owner-inbox-status");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-error");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("is-error", !!isError);
  }

  function scheduleOwnerConsolePanelHeightSync() {
    /* Panel heights are fixed via CSS (--owner-console-panel-h on .owner-console-layout). */
  }

  function syncOwnerConsolePanelHeights() {
    /* No-op: equal heights handled in site.css */
  }

  function bindOwnerConsolePanelHeightSync() {
    /* No-op */
  }

  const SENT_FIELD_ICONS = {
    owner:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    price:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    preference:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.4"/></svg>',
    maps:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    sent:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    id:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
  };

  function formatSentDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  function renderInbox() {
    const list = $("owner-lead-list");
    const empty = $("owner-inbox-empty");
    if (!list || !empty) return;

    const rows = filterLeads();
    const searching = String(inboxSearchQuery || "").trim().length > 0;
    const titleEl = empty.querySelector(".dash-empty-title");
    const descEl = empty.querySelector(".dash-empty-desc");

    if (!rows.length) {
      list.hidden = true;
      list.innerHTML = "";
      if (titleEl) {
        titleEl.textContent = searching ? "No matching leads" : "No leads in this view";
      }
      if (descEl) {
        descEl.textContent = searching
          ? "Try another name, phone number, or clear the search."
          : "When reps send leads from Lead Builder, they appear here.";
      }
      empty.hidden = false;
      scheduleOwnerConsolePanelHeightSync();
      return;
    }

    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = rows
      .map((row) => {
        const status = String(row.sale_status || "submitted").toLowerCase();
        const isPending = status === "submitted";
        const price = row.price ? esc(row.price) : "—";
        const phone = row.phone ? esc(row.phone) : "";
        const when = formatTimeAgo(row.created_at);
        const repName = esc(row.rep_name || row.rep_id || "Rep");
        const biz = esc(row.business_name || "Business");
        const id = esc(row.id);

        // Collapsed view shows only the essentials; full details live in the
        // expandable panel below (opened by clicking the lead).
        const sentRows = [];
        const sentRow = (label, valueHtml, icon) => {
          if (!valueHtml) return;
          sentRows.push(
            '<div class="owner-console-ni-row">' +
            '<dt class="owner-console-ni-row-label">' +
            (icon
              ? '<span class="owner-console-ni-row-ico" aria-hidden="true">' + icon + "</span>"
              : "") +
            "<span>" + label + "</span>" +
            "</dt>" +
            '<dd class="owner-console-ni-row-value">' + valueHtml + "</dd>" +
            "</div>"
          );
        };

        const ownerName = String(row.owner_name || "").trim();
        const preference = String(row.preference || "").trim();
        const mapsUrl = String(row.google_maps || "").trim();
        const leadId = String(row.lead_id || "").trim();
        const tel = telHrefFromPhone(row.phone);
        const phoneVal = phone
          ? tel
            ? '<a class="owner-console-ni-detail-link" href="' + esc(tel) + '">' + phone + "</a>"
            : phone
          : "";
        const mapsVal =
          mapsUrl && mapsUrl !== "#"
            ? '<a class="owner-console-ni-detail-link" href="' +
              esc(mapsUrl) +
              '" target="_blank" rel="noopener noreferrer">Open in Maps</a>'
            : "";
        const sentVal = row.created_at
          ? '<time datetime="' + esc(row.created_at) + '">' + esc(formatSentDate(row.created_at)) + "</time>"
          : "";

        sentRow("Owner", ownerName ? esc(ownerName) : "", SENT_FIELD_ICONS.owner);
        sentRow("Phone", phoneVal, SENT_FIELD_ICONS.phone);
        sentRow("Package", row.price ? esc(row.price) : "", SENT_FIELD_ICONS.price);
        sentRow("Preference", preference ? esc(preference) : "", SENT_FIELD_ICONS.preference);
        sentRow("Google Maps", mapsVal, SENT_FIELD_ICONS.maps);
        sentRow("Sent", sentVal, SENT_FIELD_ICONS.sent);
        sentRow(
          "Lead ID",
          leadId ? '<code class="owner-console-ni-id">' + esc(leadId) + "</code>" : "",
          SENT_FIELD_ICONS.id
        );

        if (status === "confirmed") {
          const sale = Number(row.sale_amount) || 0;
          const comm = Number(row.commission_amount) || 0;
          if (sale || comm) {
            sentRow("Sale", "$" + formatMoney(sale), SENT_FIELD_ICONS.price);
            sentRow("Commission", "$" + formatMoney(comm), SENT_FIELD_ICONS.price);
          }
        }

        const detailsHtml = sentRows.length
          ? '<div class="owner-console-sent-details owner-console-ni-details" hidden>' +
            '<dl class="owner-console-ni-grid">' +
            sentRows.join("") +
            "</dl>" +
            "</div>"
          : "";

        let actions = "";
        if (isPending) {
          actions =
            '<div class="dash-pending-item-actions">' +
            '<button type="button" class="dash-pending-btn" data-confirm="' +
            id +
            '">Confirm</button>' +
            '<button type="button" class="dash-pending-btn owner-console-btn--ghost" data-later="' +
            id +
            '">Later</button>' +
            '<button type="button" class="dash-pending-btn owner-console-btn--danger" data-delete="' +
            id +
            '" aria-label="Delete ' +
            biz +
            '">Delete</button>' +
            "</div>";
        } else if (status === "confirmed") {
          const sale = Number(row.sale_amount) || 0;
          const comm = Number(row.commission_amount) || 0;
          actions =
            '<div class="dash-pending-item-actions owner-console-lead-actions--meta">' +
            '<p class="owner-console-lead-confirmed-meta">' +
            "$" +
            formatMoney(sale) +
            " sale · $" +
            formatMoney(comm) +
            " commission</p>" +
            '<button type="button" class="dash-pending-btn owner-console-btn--danger" data-delete="' +
            id +
            '" aria-label="Delete ' +
            biz +
            '">Delete</button>' +
            "</div>";
        } else {
          actions =
            '<div class="dash-pending-item-actions">' +
            '<button type="button" class="dash-pending-btn owner-console-btn--danger" data-delete="' +
            id +
            '" aria-label="Delete ' +
            biz +
            '">Delete</button>' +
            "</div>";
        }

        return (
          '<li class="dash-pending-item owner-console-lead-item owner-console-sent-item" data-lead-id="' +
          id +
          '">' +
          '<div class="owner-console-sent-row">' +
          '<button type="button" class="owner-console-sent-head" aria-expanded="false"' +
          (detailsHtml ? "" : " disabled") +
          ">" +
          '<span class="owner-console-sent-head-main">' +
          '<span class="owner-console-sent-head-top">' +
          '<span class="dash-pending-name">' +
          biz +
          "</span>" +
          '<span class="owner-console-status ' +
          statusClass(status) +
          '">' +
          esc(statusLabel(status)) +
          "</span>" +
          "</span>" +
          '<span class="owner-console-sent-sub">' +
          '<span class="owner-console-lead-rep">' +
          repName +
          "</span>" +
          '<span class="dash-pending-dot" aria-hidden="true">·</span>' +
          '<time class="dash-pending-time" datetime="' +
          esc(row.created_at || "") +
          '">' +
          esc(when) +
          "</time>" +
          "</span>" +
          "</span>" +
          (detailsHtml
            ? '<span class="owner-console-sent-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>'
            : "") +
          "</button>" +
          actions +
          "</div>" +
          detailsHtml +
          "</li>"
        );
      })
      .join("");
    scheduleOwnerConsolePanelHeightSync();
  }

  async function loadLeads() {
    const sb = getClient();
    setInboxStatus("");

    try {
      if (!sb) {
        setInboxStatus(
          "Supabase is not configured. Run supabase-owner-sales-console.sql and check js/config.js.",
          true
        );
        leads = [];
        renderInbox();
        return;
      }

      const { data, error } = await withTimeout(
        sb
          .from("new_clients")
          .select(LEAD_COLUMNS)
          .order("created_at", { ascending: false }),
        LEADS_QUERY_MS,
        "Loading leads"
      );

      if (error) {
        if (/sale_status|sale_amount|commission_amount|confirmed_at|tracker_deal_id/i.test(error.message || "")) {
          const fallback = await withTimeout(
            sb
              .from("new_clients")
              .select(
                "id, rep_id, rep_name, business_name, price, phone, owner_name, preference, google_maps, created_at, lead_id"
              )
              .order("created_at", { ascending: false }),
            LEADS_QUERY_MS,
            "Loading leads"
          );
          if (fallback.error) throw fallback.error;
          leads = Array.isArray(fallback.data) ? fallback.data : [];
        } else {
          throw error;
        }
      } else {
        leads = Array.isArray(data) ? data : [];
      }
      pruneLaterLeadIds();
      renderInbox();
      const searchInput = $("owner-inbox-search");
      if (searchInput === document.activeElement) {
        showInboxSearchSuggestions();
      }
      loadReps({ includeCloud: true, includeLeads: true }).catch((e) => {
        console.warn("Owner console: rep list refresh failed", e);
      });
    } catch (e) {
      setInboxStatus(e?.message || "Could not load sent leads.", true);
      leads = [];
      renderInbox();
    }
  }

  function setNiStatus(msg, isError) {
    const el = $("owner-ni-status");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-error");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("is-error", !!isError);
  }

  function isNotInterestedHash() {
    const hash = String(global.location.hash || "")
      .replace(/^#/, "")
      .toLowerCase();
    return hash === "not-interested" || hash === "not_interested";
  }

  function scrollToNotInterestedSection(options) {
    const section =
      $("owner-not-interested-section") || document.querySelector(".owner-console-not-interested");
    if (!section) return;
    section.scrollIntoView({
      behavior: options?.instant ? "auto" : "smooth",
      block: "start",
    });
    if (options?.highlight !== false) {
      section.classList.add("owner-console-ni-section--focus");
      global.setTimeout(() => section.classList.remove("owner-console-ni-section--focus"), 2200);
    }
  }

  const NI_FIELD_ICONS = {
    called:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    phone:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    category:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.4"/></svg>',
    address:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    rating:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    id:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    reason:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  };

  function renderNotInterested() {
    const list = $("owner-ni-list");
    const empty = $("owner-ni-empty");
    const countEl = $("owner-ni-count");
    if (!list || !empty) return;

    const rows = notInterestedRows;
    if (countEl) {
      countEl.textContent =
        rows.length === 1 ? "1 business" : rows.length ? rows.length + " businesses" : "";
    }

    if (!rows.length) {
      list.hidden = true;
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.hidden = false;
    list.innerHTML = rows
      .map((row) => {
        const biz = esc(row.business_name || row.lead_id || "Business");
        const rep = String(row.called_by || row.called_by_id || "").trim();
        const whenIso = String(row.called_at || row.updated_at || "");
        const when = esc(formatTimeAgo(whenIso));
        const leadId = esc(row.lead_id || "");
        const phone = formatNiPhone(row.phone);
        const phoneEsc = esc(phone);
        const tel = telHrefFromPhone(row.phone);
        const category = String(row.category || "").trim();
        const address = String(row.address || "").trim();
        const mapsUrl = String(row.google_maps || "").trim();
        const mapsEsc = esc(mapsUrl);
        const website = String(row.website || "").trim();
        const websiteEsc = esc(website);
        const ratingPlain = formatNiRatingPlain(row);
        const niRows = [];
        const niRow = (label, valueHtml, icon) => {
          if (!valueHtml) return;
          niRows.push(
            '<div class="owner-console-ni-row">' +
            '<dt class="owner-console-ni-row-label">' +
            (icon
              ? '<span class="owner-console-ni-row-ico" aria-hidden="true">' + icon + "</span>"
              : "") +
            "<span>" + label + "</span>" +
            "</dt>" +
            '<dd class="owner-console-ni-row-value">' + valueHtml + "</dd>" +
            "</div>"
          );
        };

        const whenVal = when
          ? '<time datetime="' + esc(whenIso) + '">' + when + "</time>"
          : "";
        const phoneVal = phoneEsc
          ? tel
            ? '<a class="owner-console-ni-detail-link" href="' + esc(tel) + '">' + phoneEsc + "</a>"
            : phoneEsc
          : "";

        niRow("Called", whenVal, NI_FIELD_ICONS.called);
        niRow("Phone", phoneVal, NI_FIELD_ICONS.phone);
        niRow("Category", category ? esc(category) : "", NI_FIELD_ICONS.category);
        niRow("Address", address ? esc(address) : "", NI_FIELD_ICONS.address);
        niRow("Rating", ratingPlain ? esc(ratingPlain) : "", NI_FIELD_ICONS.rating);
        niRow(
          "Lead ID",
          leadId ? '<code class="owner-console-ni-id">' + leadId + "</code>" : "",
          NI_FIELD_ICONS.id
        );

        const gridHtml = niRows.length
          ? '<dl class="owner-console-ni-grid">' + niRows.join("") + "</dl>"
          : "";

        const reason = String(row.not_interested_reason || "").trim();
        const reasonHtml =
          '<div class="owner-console-ni-reason-box' +
          (reason ? "" : " owner-console-ni-reason-box--empty") +
          '">' +
          '<span class="owner-console-ni-reason-label">' +
          '<span class="owner-console-ni-reason-ico" aria-hidden="true">' +
          NI_FIELD_ICONS.reason +
          "</span>Reason for not interested</span>" +
          '<p class="owner-console-ni-reason-text">' +
          (reason ? esc(reason) : "No comment left.") +
          "</p>" +
          "</div>";

        const niAction = (href, attrs, icon, label, aria) =>
          '<a class="owner-console-ni-action" href="' +
          href +
          '"' +
          attrs +
          ' aria-label="' +
          aria +
          '"><span class="owner-console-ni-action-ico" data-icon="' +
          icon +
          '" data-icon-class="owner-console-ni-action-ico-svg" aria-hidden="true"></span>' +
          '<span class="owner-console-ni-action-label">' +
          label +
          "</span></a>";

        const actionButtons =
          (tel ? niAction(esc(tel), "", "phone", "Call", "Call " + biz) : "") +
          (mapsUrl && mapsUrl !== "#"
            ? niAction(
                mapsEsc,
                ' target="_blank" rel="noopener noreferrer"',
                "map-pin",
                "Maps",
                "Open in Maps"
              )
            : "") +
          (website
            ? niAction(
                websiteEsc,
                ' target="_blank" rel="noopener noreferrer"',
                "globe",
                "Website",
                "Open website"
              )
            : "");

        const actionsHtml = actionButtons
          ? '<div class="owner-console-ni-actions">' + actionButtons + "</div>"
          : "";

        const repHtml = rep
          ? '<span class="owner-console-ni-rep"><span class="owner-console-ni-rep-label">Rep</span>' +
            esc(rep) +
            "</span>"
          : '<span class="owner-console-ni-rep owner-console-ni-rep--empty">Unknown rep</span>';

        return (
          '<li class="dash-pending-item owner-console-lead-item owner-console-ni-item" data-lead-id="' +
          leadId +
          '">' +
          '<button type="button" class="owner-console-ni-head" aria-expanded="false">' +
          '<span class="owner-console-ni-head-main">' +
          '<span class="dash-pending-name owner-console-ni-name">' +
          biz +
          "</span>" +
          repHtml +
          "</span>" +
          '<span class="owner-console-ni-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>' +
          "</button>" +
          '<div class="owner-console-ni-details" hidden>' +
          gridHtml +
          reasonHtml +
          actionsHtml +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    if (!list.dataset.niToggleBound) {
      list.dataset.niToggleBound = "1";
      list.addEventListener("click", (e) => {
        const head = e.target.closest(".owner-console-ni-head");
        if (!head || !list.contains(head)) return;
        const item = head.closest(".owner-console-ni-item");
        if (!item) return;
        const details = item.querySelector(".owner-console-ni-details");
        const open = item.classList.toggle("is-open");
        head.setAttribute("aria-expanded", open ? "true" : "false");
        if (details) details.hidden = !open;
      });
    }

    if (global.SiteIcons) global.SiteIcons.initIcons(list);
  }

  async function loadNotInterested() {
    const sb = getClient();
    setNiStatus("");

    if (!sb) {
      notInterestedRows = [];
      renderNotInterested();
      return;
    }

    const fullSelect =
      "lead_id, business_name, phone, google_maps, category, address, not_interested_reason, called_by, called_by_id, called_at, workflow, updated_at";
    const basicSelect =
      "lead_id, business_name, called_by, called_by_id, called_at, workflow, updated_at";

    async function queryNotInterested(select) {
      return withTimeout(
        sb
          .from("lead_status")
          .select(select)
          .eq("workflow", "not-interested")
          .order("called_at", { ascending: false, nullsFirst: false })
          .limit(250),
        LEADS_QUERY_MS,
        "Loading not interested"
      );
    }

    try {
      let data = null;
      let error = null;
      ({ data, error } = await queryNotInterested(fullSelect));
      if (
        error &&
        /phone|google_maps|category|address|not_interested_reason|column.*does not exist/i.test(String(error.message || error))
      ) {
        ({ data, error } = await queryNotInterested(basicSelect));
      }
      if (error) throw error;
      notInterestedRows = await enrichNotInterestedRows(sb, Array.isArray(data) ? data : []);
      renderNotInterested();
    } catch (e) {
      setNiStatus(e?.message || "Could not load not interested businesses.", true);
      notInterestedRows = [];
      renderNotInterested();
    }
  }

  function unsubscribeNotInterested() {
    const sb = getClient();
    if (niRealtimeChannel && sb) {
      sb.removeChannel(niRealtimeChannel);
      niRealtimeChannel = null;
    }
    clearTimeout(niRefreshTimer);
    niRefreshTimer = null;
  }

  function subscribeNotInterested() {
    unsubscribeNotInterested();
    const sb = getClient();
    if (!sb) return;

    niRealtimeChannel = sb
      .channel("owner-not-interested")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_status" },
        () => {
          clearTimeout(niRefreshTimer);
          niRefreshTimer = global.setTimeout(() => {
            loadNotInterested().catch((e) =>
              console.warn("Owner console: not interested refresh failed", e)
            );
          }, 320);
        }
      )
      .subscribe();
  }

  function addRepToMap(map, id, name) {
    const rid = String(id || "").trim();
    if (!rid) return;
    const key = rid.toLowerCase();
    const label = String(name || "").trim() || rid;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { id: rid, name: label });
      return;
    }
    if (label && label.length >= existing.name.length) {
      map.set(key, { id: existing.id || rid, name: label });
    }
  }

  function repsFromMap(map) {
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }

  function repToggleLabel(rep) {
    return String(rep?.id || "").trim() || String(rep?.name || "").trim();
  }

  function renderRepToggles() {
    const container = $("owner-rep-toggles");
    const segment = $("owner-rep-segment");
    if (!container) return;

    if (!reps.length) {
      container.innerHTML =
        '<p class="owner-console-rep-empty">No reps loaded yet.</p>';
      segment?.classList.add("is-empty");
      return;
    }

    segment?.classList.remove("is-empty");

    const current = String(selectedRepId || "").toLowerCase();
    container.innerHTML = reps
      .map((r) => {
        const active = r.id.toLowerCase() === current;
        return (
          '<button type="button" class="owner-console-rep-toggle' +
          (active ? " is-active" : "") +
          '" data-rep-id="' +
          esc(r.id) +
          '" role="tab" aria-selected="' +
          (active ? "true" : "false") +
          '" title="' +
          esc(r.name) +
          '">' +
          esc(repToggleLabel(r)) +
          "</button>"
        );
      })
      .join("");

    const activeBtn = container.querySelector(".owner-console-rep-toggle.is-active");
    activeBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    scheduleOwnerConsolePanelHeightSync();
  }

  function selectRep(repId) {
    const prev = String(selectedRepId || "").toLowerCase();
    selectedRepId = String(repId || "").trim();
    if (prev !== selectedRepId.toLowerCase()) {
      viewingBannerDismissed = false;
    }
    renderRepToggles();
    updateViewingBanner();

    if (!selectedRepId) {
      unsubscribeTeam();
      hideTeamPanel();
      global.OwnerConsoleTeamOverview?.highlightRep?.("");
      return;
    }

    showTeamPanel();
    loadRepTracker(selectedRepId);
    subscribeTeam(selectedRepId);
    global.OwnerConsoleTeamOverview?.highlightRep?.(selectedRepId);
  }

  function toggleRep(repId) {
    const id = canonicalRepId(repId);
    if (!id) return;
    if (id.toLowerCase() === String(selectedRepId || "").toLowerCase()) {
      selectRep("");
      return;
    }
    selectRep(id);
  }

  function getSelectedRepId() {
    return selectedRepId;
  }

  function ensureOwnerRepsInMap(map) {
    const cfg = global.SITE_CONFIG || {};
    (cfg.ownerRepIds || []).forEach((id) => {
      const rid = String(id || "").trim().toLowerCase();
      if (!rid) return;
      const fromContributor = (cfg.contributors || []).find(
        (name) => String(name || "").trim().toLowerCase() === rid
      );
      const label =
        fromContributor ||
        (rid === "delexo" ? String(cfg.ownerName || "Delexo").trim() : "") ||
        rid;
      addRepToMap(map, rid, label);
    });
  }

  async function loadRepsFromUsersFile(map) {
    try {
      const res = await fetch("users.txt");
      if (!res.ok) return;
      const text = await res.text();
      String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .forEach((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return;
          const parts = trimmed.split(",").map((s) => s.trim());
          if (parts.length < 2) return;
          addRepToMap(map, parts[0], parts[1]);
        });
    } catch (e) {
      /* optional fallback */
    }
  }

  async function loadReps(options) {
    const includeCloud = options?.includeCloud !== false;
    const includeLeads = options?.includeLeads !== false;
    const map = new Map();

    reps.forEach((r) => addRepToMap(map, r.id, r.name));

    try {
      const res = await withTimeout(fetch(REPS_URL), 4000, "Rep list");
      const data = await res.json();
      (Array.isArray(data?.reps) ? data.reps : []).forEach((r) =>
        addRepToMap(map, r.id, r.name)
      );
    } catch (e) {
      console.warn("Owner console: could not load reps.json", e);
    }

    await loadRepsFromUsersFile(map);

    ensureOwnerRepsInMap(map);

    if (includeLeads) {
      leads.forEach((row) => addRepToMap(map, row.rep_id, row.rep_name));
    }

    const sb = getClient();
    if (includeCloud && sb) {
      try {
        const { data, error } = await withTimeout(
          sb.from("rep_settings").select("rep_id, rep_name").order("rep_name", {
            ascending: true,
          }),
          REPS_QUERY_MS,
          "Rep list"
        );
        if (error) {
          console.warn("Owner console: could not load rep_settings", error);
        } else {
          (data || []).forEach((row) => addRepToMap(map, row.rep_id, row.rep_name));
        }
      } catch (e) {
        console.warn("Owner console: rep_settings fetch failed", e);
      }
    }

    reps = repsFromMap(map).sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { sensitivity: "base" })
    );
    renderRepToggles();
    updateViewingBanner();
  }

  function calcEarned(deals) {
    return (deals || []).reduce((sum, d) => sum + (Number(d.commission) || 0), 0);
  }

  function saleAmountFromDeal(d) {
    if (!d) return 0;
    const stored = Number(d.saleAmount ?? d.downAmount);
    if (stored > 0) return stored;
    const comm = Number(d.commission) || 0;
    if (!comm) return 0;
    for (const tier of SALE_TIERS) {
      if (commissionFromSale(tier) === comm) return tier;
    }
    return Math.round(comm / 0.4);
  }

  function parseSaleAmount(raw) {
    const n = parseFloat(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function getTeamDeal(dealId) {
    return (teamTrackerCache?.deals || []).find((d) => String(d.id) === String(dealId));
  }

  async function saveTeamTracker(tracker) {
    const sb = getClient();
    const repId = String(selectedRepId || "").trim();
    if (!sb || !repId || !tracker) return false;

    busy = true;
    setInboxStatus("");

    try {
      const { data: existing, error: readErr } = await withTimeout(
        sb.from("rep_settings").select("settings_json, rep_name").eq("rep_id", repId).maybeSingle(),
        REPS_QUERY_MS,
        "Save tracker"
      );
      if (readErr) throw readErr;

      const repName = repDisplayName(repId) || existing?.rep_name || repId;
      const settings = { ...(existing?.settings_json || {}) };
      const nextTracker = {
        ...tracker,
        repId,
        name: repName,
        goal: Math.max(1, Number(tracker.goal) || 1000),
        deals: Array.isArray(tracker.deals) ? tracker.deals : [],
        deletedDealIds: Array.isArray(tracker.deletedDealIds) ? tracker.deletedDealIds : [],
      };
      settings.lpc_sales_tracker_v2 = nextTracker;

      const { error } = await withTimeout(
        sb.from("rep_settings").upsert(
          {
            rep_id: repId,
            rep_name: repName,
            settings_json: settings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "rep_id" }
        ),
        REPS_QUERY_MS,
        "Save tracker"
      );
      if (error) throw error;

      teamTrackerCache = nextTracker;
      renderTeamPanel(teamTrackerCache);
      return true;
    } catch (e) {
      console.warn("Owner console: could not save tracker", e);
      setInboxStatus(e.message || "Could not save sale change.", true);
      return false;
    } finally {
      busy = false;
    }
  }

  function closeTeamSaleEdit(card) {
    if (!card) return;
    card.classList.remove("is-editing");
  }

  function openTeamSaleEdit(dealId) {
    const list = $("owner-team-deals");
    if (!list) return;
    if (!getTeamDeal(dealId)) return;

    list.querySelectorAll(".sale-card.is-editing").forEach((card) => {
      if (card.getAttribute("data-deal-id") !== String(dealId)) closeTeamSaleEdit(card);
    });

    const card = list.querySelector('.sale-card[data-deal-id="' + dealId + '"]');
    if (!card) return;
    card.classList.add("is-editing");
    const input = card.querySelector('.sale-card-edit-form input[name="amount"]');
    input?.focus();
  }

  async function saveTeamSaleEdit(dealId, form) {
    const deal = getTeamDeal(dealId);
    if (!deal || !form || !teamTrackerCache) return;

    const amountEl = form.querySelector('input[name="amount"]');
    const businessEl = form.querySelector('input[name="businessName"]');
    const saleAmount = parseSaleAmount(amountEl?.value);
    if (saleAmount <= 0) {
      global.alert("Enter a sale amount greater than $0.");
      amountEl?.focus();
      return;
    }

    const nextDeals = (teamTrackerCache.deals || []).map((d) => {
      if (String(d.id) !== String(dealId)) return d;
      return {
        ...d,
        businessName: businessEl?.value.trim() || "",
        saleAmount,
        commission: commissionFromSale(saleAmount),
      };
    });

    const ok = await saveTeamTracker({ ...teamTrackerCache, deals: nextDeals });
    if (ok) {
      setInboxStatus("Sale updated on " + (repDisplayName(selectedRepId) || "rep") + "'s dashboard.");
    }
  }

  async function deleteTeamSale(dealId) {
    const deal = getTeamDeal(dealId);
    if (!deal || !teamTrackerCache || busy) return;

    const biz = deal.businessName || "this sale";
    const repName = repDisplayName(selectedRepId) || "rep";
    let msg = 'Delete "' + biz + '" from ' + repName + "'s tracker?";
    if (deal.fromOwnerConfirm) {
      msg += " This removes the owner-confirmed sale from their dashboard.";
    }
    if (!global.confirm(msg)) return;

    const id = String(dealId || "").trim();
    const nextDeals = (teamTrackerCache.deals || []).filter((d) => String(d.id) !== id);
    const deletedDealIds = Array.isArray(teamTrackerCache.deletedDealIds)
      ? [...teamTrackerCache.deletedDealIds]
      : [];
    if (id && !deletedDealIds.includes(id)) deletedDealIds.push(id);
    const ok = await saveTeamTracker({
      ...teamTrackerCache,
      deals: nextDeals,
      deletedDealIds,
    });
    if (ok) {
      setInboxStatus("Sale removed from " + repName + "'s tracker.");
    }
  }

  function renderTeamPanel(tracker) {
    const panel = $("owner-team-panel");
    if (!panel) return;

    if (!selectedRepId) {
      panel.hidden = true;
      return;
    }

    panel.hidden = false;
    const goal = Math.max(1, Number(tracker?.goal) || 1000);
    const deals = [...(tracker?.deals || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const earned = calcEarned(deals);
    const pct = Math.min(100, Math.round((earned / goal) * 100));

    animateTeamTracker({
      goal,
      earned,
      sales: deals.length,
      pct,
    });

    const dealsList = $("owner-team-deals");
    const dealsEmpty = $("owner-team-deals-empty");
    const recent = deals.slice(0, 10);

    if (!dealsList) return;

    if (!recent.length) {
      teamTrackerCache = {
        ...(tracker && typeof tracker === "object" ? tracker : {}),
        goal,
        deals,
        repId: selectedRepId,
        name: repDisplayName(selectedRepId),
      };
      dealsList.innerHTML = "";
      dealsEmpty?.removeAttribute("hidden");
      return;
    }

    dealsEmpty?.setAttribute("hidden", "");
    teamTrackerCache = {
      ...(tracker && typeof tracker === "object" ? tracker : {}),
      goal,
      deals,
      repId: selectedRepId,
      name: repDisplayName(selectedRepId),
    };
    teamDealsCache = recent;
    dealsList.innerHTML = recent
      .map((d) => {
        const title = esc(d.businessName || "Sale");
        const amount = formatMoney(Number(d.commission) || 0);
        const when = esc(formatDealWhen(d.createdAt));
        const isOwnerLocked = !!d.fromOwnerConfirm;
        const tag = isOwnerLocked
          ? '<span class="sale-card-owner-badge">Owner Confirmed</span>'
          : "";
        const dealId = esc(d.id || "");
        const saleAmount = saleAmountFromDeal(d);

        const editForm =
          '<form class="sale-card-edit-form" data-team-sale-edit-form="' +
          dealId +
          '">' +
          '<div class="sale-card-edit-grid">' +
          '<label class="sale-card-edit-field">' +
          "<span>Business name <span class=\"dash-income-field-optional\">(optional)</span></span>" +
          '<input type="text" name="businessName" value="' +
          esc(d.businessName || "") +
          '" placeholder="Business name">' +
          "</label>" +
          '<label class="sale-card-edit-field">' +
          "<span>Sale amount</span>" +
          '<input type="number" name="amount" min="1" step="0.01" value="' +
          esc(String(saleAmount)) +
          '" inputmode="decimal" required>' +
          "</label>" +
          "</div>" +
          '<div class="sale-card-edit-actions">' +
          '<button type="button" class="btn secondary sale-card-cancel-btn" data-team-sale-cancel="' +
          dealId +
          '">Cancel</button>' +
          '<button type="submit" class="btn sale-card-save-btn">Save changes</button>' +
          "</div>" +
          "</form>";

        const actionButtons =
          '<div class="sale-card-actions">' +
          '<button type="button" class="sale-card-edit-btn sale-card-edit-btn--icon" data-team-sale-edit="' +
          dealId +
          '" aria-label="Edit ' +
          title +
          '">' +
          '<span data-icon="pencil" data-icon-class="sale-card-edit-ico" aria-hidden="true"></span>' +
          "</button>" +
          '<button type="button" class="sale-card-delete-btn" data-team-sale-delete="' +
          dealId +
          '" aria-label="Delete ' +
          title +
          '">' +
          '<span data-icon="trash-2" data-icon-class="sale-card-delete-ico" aria-hidden="true"></span>' +
          "</button>" +
          "</div>";

        const metaSep =
          tag && when
            ? '<span class="owner-console-sale-card-dot" aria-hidden="true">·</span>'
            : "";

        return (
          '<article class="sale-card owner-console-sale-card' +
          (isOwnerLocked ? " sale-card--owner-locked sale-card--clickable" : "") +
          '" data-deal-id="' +
          dealId +
          '"' +
          (isOwnerLocked
            ? ' role="button" tabindex="0" aria-label="View owner confirmed sale details for ' +
              title +
              '"'
            : "") +
          ">" +
          '<div class="sale-card-view">' +
          '<div class="owner-console-sale-card-top">' +
          '<strong class="sale-card-title">' +
          title +
          "</strong>" +
          '<span class="sale-amount">$' +
          amount +
          "</span>" +
          "</div>" +
          '<div class="owner-console-sale-card-foot">' +
          '<div class="owner-console-sale-card-meta">' +
          tag +
          metaSep +
          '<time class="sale-card-date" datetime="' +
          esc(d.createdAt || "") +
          '">' +
          when +
          "</time>" +
          "</div>" +
          actionButtons +
          "</div>" +
          "</div>" +
          editForm +
          "</article>"
        );
      })
      .join("");

    if (global.SiteIcons?.initIcons) global.SiteIcons.initIcons(dealsList);
    scheduleOwnerConsolePanelHeightSync();
  }

  function openTeamOwnerConfirmedDetails(dealId) {
    const deal = teamDealsCache.find((d) => String(d.id) === String(dealId));
    if (!deal?.fromOwnerConfirm) return;
    const payload = {
      ...deal,
      repName: repDisplayName(selectedRepId) || deal.repName || "",
    };
    global.OwnerConfirmedSaleDetails?.open(payload, {
      commissionLabel: "Commission earned",
    });
  }

  function bindTeamDealsList() {
    const list = $("owner-team-deals");
    if (!list || list.dataset.bound === "1") return;
    list.dataset.bound = "1";

    list.addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-team-sale-edit]");
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        openTeamSaleEdit(editBtn.getAttribute("data-team-sale-edit"));
        return;
      }

      const cancelBtn = e.target.closest("[data-team-sale-cancel]");
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        closeTeamSaleEdit(cancelBtn.closest(".sale-card"));
        return;
      }

      const deleteBtn = e.target.closest("[data-team-sale-delete]");
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        void deleteTeamSale(deleteBtn.getAttribute("data-team-sale-delete"));
        return;
      }

      if (e.target.closest(".sale-card-actions, .sale-card-edit-form")) return;

      const card = e.target.closest(".sale-card--owner-locked");
      if (!card) return;
      e.preventDefault();
      openTeamOwnerConfirmedDetails(card.getAttribute("data-deal-id"));
    });

    list.addEventListener("keydown", (e) => {
      const card = e.target.closest(".sale-card--owner-locked");
      if (!card || (e.key !== "Enter" && e.key !== " ")) return;
      if (e.target.closest(".sale-card-actions, .sale-card-edit-form")) return;
      e.preventDefault();
      openTeamOwnerConfirmedDetails(card.getAttribute("data-deal-id"));
    });

    list.addEventListener("submit", (e) => {
      const form = e.target.closest("[data-team-sale-edit-form]");
      if (!form) return;
      e.preventDefault();
      void saveTeamSaleEdit(form.getAttribute("data-team-sale-edit-form"), form);
    });
  }

  async function loadRepTracker(repId) {
    const sb = getClient();
    const id = String(repId || "").trim();
    if (!sb || !id) return;

    const seq = ++repTrackerSeq;

    try {
      const { data, error } = await withTimeout(
        sb
          .from("rep_settings")
          .select("settings_json, rep_name")
          .eq("rep_id", id)
          .maybeSingle(),
        REPS_QUERY_MS,
        "Team dashboard"
      );

      if (seq !== repTrackerSeq || id !== String(selectedRepId || "").trim()) return;

      if (error) {
        throw error;
      }

      const tracker = data?.settings_json?.lpc_sales_tracker_v2 || {
        goal: 1000,
        deals: [],
      };
      teamTrackerCache = tracker;
      renderTeamPanel(tracker);
    } catch (e) {
      if (seq !== repTrackerSeq || id !== String(selectedRepId || "").trim()) return;
      console.warn("Owner console tracker load failed", e);
      renderTeamPanel({ goal: 1000, deals: [] });
    }
  }

  function unsubscribeTeam() {
    const sb = getClient();
    if (realtimeChannel && sb) {
      sb.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  }

  function subscribeTeam(repId) {
    unsubscribeTeam();
    const sb = getClient();
    if (!sb || !repId) return;

    realtimeChannel = sb
      .channel("owner-sales-rep-" + repId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rep_settings",
          filter: "rep_id=eq." + repId,
        },
        () => {
          clearTimeout(repTrackerTimer);
          repTrackerTimer = global.setTimeout(() => {
            loadRepTracker(repId);
          }, 250);
        }
      )
      .subscribe();
  }

  function updateCommissionPreview() {
    const el = $("owner-commission-preview");
    if (!el) return;
    const comm = commissionFromSale(selectedSaleAmount);
    el.innerHTML =
      "Commission (40%): <strong>$" + formatMoney(comm) + "</strong>";
  }

  function setSelectedTier(amount) {
    selectedSaleAmount = amount;
    const pills = document.querySelectorAll("#owner-tier-pills .pill");
    pills.forEach((btn) => {
      const n = Number(btn.dataset.sale);
      btn.classList.toggle("active", n === amount);
    });
    updateCommissionPreview();
  }

  function formatSubmittedWhen(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function confirmDetailRow(label, valueHtml) {
    const content = String(valueHtml || "").trim();
    if (!content) return "";
    return (
      '<div class="owner-console-detail-row">' +
      "<dt>" +
      esc(label) +
      "</dt>" +
      "<dd>" +
      content +
      "</dd>" +
      "</div>"
    );
  }

  function renderLeadDetails(el, row) {
    if (!el || !row) return;

    const repName = esc(
      repDisplayName(row.rep_id) || row.rep_name || row.rep_id || "—"
    );
    const business = esc(row.business_name || "—");
    const price = esc(row.price || "—");
    const phone = esc(row.phone || "");
    const ownerName = esc(row.owner_name || "");
    const preference = esc(row.preference || "");
    const leadId = esc(row.lead_id || "");
    const submitted = esc(formatSubmittedWhen(row.created_at));

    let mapsHtml = "";
    const mapsRaw = String(row.google_maps || "").trim();
    if (mapsRaw) {
      if (/^https?:\/\//i.test(mapsRaw)) {
        mapsHtml =
          '<a href="' +
          esc(mapsRaw) +
          '" target="_blank" rel="noopener noreferrer">Open Google Maps</a>';
      } else {
        mapsHtml = esc(mapsRaw);
      }
    }

    el.innerHTML =
      confirmDetailRow("Business", "<strong>" + business + "</strong>") +
      confirmDetailRow("Rep", repName) +
      confirmDetailRow("Submitted tier", price) +
      confirmDetailRow("Phone", phone) +
      confirmDetailRow("Business owner", ownerName) +
      confirmDetailRow("Preference", preference) +
      confirmDetailRow("Google Maps", mapsHtml) +
      confirmDetailRow("Lead ID", leadId) +
      confirmDetailRow("Submitted", submitted);
  }

  function renderConfirmDetails(row) {
    renderLeadDetails($("owner-confirm-details"), row);
  }

  function openConfirmDialog(row) {
    confirmTarget = row;
    const dialog = $("owner-confirm-dialog");
    const credit = $("owner-confirm-credit");
    const err = $("owner-confirm-error");

    if (!dialog || !row) return;

    const repName = repDisplayName(row.rep_id) || row.rep_name || row.rep_id || "rep";

    renderConfirmDetails(row);

    if (credit) {
      credit.textContent =
        "Commission will be added to " + repName + "'s dashboard.";
    }

    const priceNum = parseInt(String(row.price || "").replace(/\D/g, ""), 10);
    const defaultTier = SALE_TIERS.includes(priceNum) ? priceNum : 700;
    setSelectedTier(defaultTier);

    if (err) {
      err.hidden = true;
      err.textContent = "";
    }

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    $("owner-confirm-submit")?.focus();
  }

  function closeConfirmDialog() {
    const dialog = $("owner-confirm-dialog");
    confirmTarget = null;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  async function submitConfirm() {
    if (!confirmTarget || busy) return;
    const sb = getClient();
    if (!sb) return;

    busy = true;
    const submitBtn = $("owner-confirm-submit");
    const err = $("owner-confirm-error");
    if (submitBtn) submitBtn.disabled = true;
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }

    const { data, error } = await sb.rpc("confirm_lead_sale", {
      client_id: confirmTarget.id,
      sale_amount: selectedSaleAmount,
    });

    busy = false;
    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      if (err) {
        err.hidden = false;
        err.textContent = error.message || "Could not confirm sale.";
      }
      return;
    }

    if (!data?.ok) {
      if (err) {
        err.hidden = false;
        err.textContent = "Could not confirm sale.";
      }
      return;
    }

    const confirmedRepId = canonicalRepId(
      data.repId || confirmTarget.rep_id || confirmTarget.rep_name || ""
    );

    removeLaterLeadId(confirmTarget.id);
    closeConfirmDialog();
    setInboxStatus(
      "Sale confirmed — commission added to " +
        (repDisplayName(confirmedRepId) || confirmedRepId || "rep") +
        "'s tracker."
    );
    await loadLeads();

    if (confirmedRepId) {
      selectRep(confirmedRepId);
      $("owner-team-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (selectedRepId) {
      await loadRepTracker(selectedRepId);
    }
  }

  function closeDeleteDialog() {
    const dialog = $("owner-delete-dialog");
    deleteTarget = null;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDeleteDialog(row) {
    deleteTarget = row;
    const dialog = $("owner-delete-dialog");
    const warning = $("owner-delete-warning");
    const err = $("owner-delete-error");
    const submitBtn = $("owner-delete-submit");

    if (!dialog || !row) return;

    const biz = row.business_name || "this lead";
    const status = String(row.sale_status || "submitted").toLowerCase();

    renderLeadDetails($("owner-delete-details"), row);

    if (warning) {
      warning.textContent =
        status === "confirmed"
          ? 'Delete "' +
            biz +
            '" from the inbox? The rep\'s logged commission will stay on their dashboard.'
          : 'Delete "' + biz + '" from sent leads? This cannot be undone.';
    }

    if (err) {
      err.hidden = true;
      err.textContent = "";
    }
    if (submitBtn) submitBtn.disabled = false;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    $("owner-delete-submit")?.focus();
  }

  async function submitDelete() {
    if (!deleteTarget || busy) return;
    const sb = getClient();
    if (!sb) return;

    const id = deleteTarget.id;
    busy = true;
    const submitBtn = $("owner-delete-submit");
    const err = $("owner-delete-error");
    if (submitBtn) submitBtn.disabled = true;
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }

    const { error } = await sb.rpc("delete_lead_sale", {
      client_id: id,
    });

    busy = false;
    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      if (err) {
        err.hidden = false;
        err.textContent = error.message || "Could not delete lead.";
      }
      return;
    }

    removeLaterLeadId(id);
    closeDeleteDialog();
    setInboxStatus("Lead deleted.");
    await loadLeads();
  }

  async function deleteLead(id) {
    if (busy || !id) return;
    const row = leads.find((l) => String(l.id) === String(id));
    if (row) openDeleteDialog(row);
  }

  function bindEvents() {
    document.querySelectorAll(".owner-console-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        filter = btn.dataset.filter || "pending";
        document.querySelectorAll(".owner-console-filter").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderInbox();
      });
    });

    bindInboxSearch();

    $("owner-lead-list")?.addEventListener("click", (e) => {
      const sentHead = e.target.closest(".owner-console-sent-head");
      if (sentHead) {
        const item = sentHead.closest(".owner-console-sent-item");
        if (item) {
          const details = item.querySelector(".owner-console-sent-details");
          const open = item.classList.toggle("is-open");
          sentHead.setAttribute("aria-expanded", open ? "true" : "false");
          if (details) details.hidden = !open;
        }
        return;
      }
      const confirmBtn = e.target.closest("[data-confirm]");
      if (confirmBtn) {
        const id = confirmBtn.getAttribute("data-confirm");
        const row = leads.find((l) => String(l.id) === String(id));
        if (row) openConfirmDialog(row);
        return;
      }
      const laterBtn = e.target.closest("[data-later]");
      if (laterBtn) {
        laterLead(laterBtn.getAttribute("data-later"));
        return;
      }
      const deleteBtn = e.target.closest("[data-delete]");
      if (deleteBtn) {
        deleteLead(deleteBtn.getAttribute("data-delete"));
      }
    });

    $("owner-delete-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeDeleteDialog();
    });

    $("owner-delete-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void submitDelete();
    });

    $("owner-delete-dialog")?.addEventListener("click", (e) => {
      if (e.target === $("owner-delete-dialog")) closeDeleteDialog();
    });

    $("owner-tier-pills")?.addEventListener("click", (e) => {
      const pill = e.target.closest("[data-sale]");
      if (!pill) return;
      e.preventDefault();
      setSelectedTier(Number(pill.dataset.sale));
    });

    $("owner-confirm-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeConfirmDialog();
    });

    $("owner-confirm-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      submitConfirm();
    });

    $("owner-confirm-dialog")?.addEventListener("click", (e) => {
      if (e.target === $("owner-confirm-dialog")) closeConfirmDialog();
    });

    $("owner-rep-toggles")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rep-id]");
      if (!btn) return;
      toggleRep(btn.getAttribute("data-rep-id") || "");
    });

    $("owner-viewing-banner")?.addEventListener("click", () => {
      viewingBannerDismissed = true;
      hideViewingBanner(true);
    });

    if (!global.__ownerNiHashBound) {
      global.__ownerNiHashBound = true;
      global.addEventListener("hashchange", () => {
        if (document.body.dataset.page !== "sales-console") return;
        if (isNotInterestedHash()) scrollToNotInterestedSection();
      });
    }
  }

  async function init() {
    if (initStarted) return;
    initStarted = true;
    if (!global.SiteOwner?.gateOwnerPage?.("dashboard.html")) return;

    bindEvents();
    bindOwnerConsolePanelHeightSync();
    bindTeamDealsList();
    updateViewingBanner();

    await loadReps({ includeCloud: false, includeLeads: false });

    await loadLeads();
    await loadNotInterested();
    subscribeNotInterested();

    if (isNotInterestedHash()) {
      global.requestAnimationFrame(() => scrollToNotInterestedSection());
    }

    if (!global.__ownerNiFocusBound) {
      global.__ownerNiFocusBound = true;
      global.addEventListener("focus", () => {
        if (document.body.dataset.page !== "sales-console") return;
        loadNotInterested().catch((e) =>
          console.warn("Owner console: not interested focus refresh failed", e)
        );
      });
    }
  }

  function boot() {
    if (booted) return;
    booted = true;
    if (global.SiteLock?.whenUnlocked) global.SiteLock.whenUnlocked(init);
    else init();
  }

  document.addEventListener("DOMContentLoaded", boot);
  global.addEventListener("site-app-ready", boot, { once: true });
  if (document.readyState !== "loading") boot();

  global.OwnerSalesConsole = {
    refresh: async () => {
      await loadLeads();
      await loadNotInterested();
    },
    scrollToNotInterested: scrollToNotInterestedSection,
    selectRep,
    toggleRep,
    getSelectedRepId,
  };
})(window);
