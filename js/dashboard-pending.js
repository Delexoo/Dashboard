/**
 * Dashboard · pending businesses (Lead Finder workflow).
 */
(function (global) {
  const WORKFLOW_KEY = "lpc_lead_workflow_v1";

  const $ = (id) => document.getElementById(id);

  function isPendingHostPage() {
    const page = document.body.dataset.page || "";
    return page === "home" || page === "leads";
  }

  function emptyPendingDescHtml() {
    return 'Send a lead from <strong>Lead Builder</strong> to add a business here.';
  }

  let allLeads = [];
  let statusMap = {};
  let syncApi = null;
  let ready = false;
  let refreshTimer = null;
  let backgroundRefreshTimer = null;
  let started = false;
  let loadingPending = false;
  let unsubSync = null;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function display() {
    return global.LeadDisplay || {};
  }

  function getRepId() {
    return String(
      global.RepSession?.getId?.() || global.RepSession?.get?.()?.id || ""
    ).trim();
  }

  function getRepName() {
    return String(
      global.RepSession?.getName?.() || global.RepSession?.get?.()?.name || ""
    ).trim();
  }

  function isOwnerMatch(ownerId, ownerName) {
    const meId = getRepId().toLowerCase();
    const meName = getRepName().toLowerCase();
    const oid = String(ownerId || "").trim().toLowerCase();
    const on = String(ownerName || "").trim().toLowerCase();
    if (meId && oid && meId === oid) return true;
    if (meName && on && meName === on) return true;
    if (meId && on && meId === on) return true;
    if (meName && oid && meName === oid) return true;
    return false;
  }

  function statusEntry(leadId) {
    return statusMap[String(leadId)] || statusMap[leadId] || null;
  }

  function leadFromStatusEntry(id, entry) {
    const name = String(entry?.businessName || entry?.business_name || "").trim();
    return {
      id,
      name: name || "Business",
      category: "Pending",
      categoryGroup: "Pending",
      phone: "",
      address: "",
      mapsUrl: "#",
      website: "",
      hours: "",
      hasWebsite: false,
      rating: null,
      reviewCount: null,
      dedupeKey: id,
      sources: [],
      _statusOnly: true,
    };
  }

  function mergeLocalPendingOverlay() {
    if (!getRepId()) return;
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(WORKFLOW_KEY)
        : null;
      const overlay = raw ? JSON.parse(raw) : {};
      Object.entries(overlay).forEach(([id, entry]) => {
        if (entry?.workflow !== "pending") return;
        const sid = String(id);
        const existing = statusMap[sid];
        if (existing?.workflow === "pending" && isOwnerMatch(existing.pendingById, existing.pendingBy)) {
          return;
        }
        statusMap[sid] = {
          workflow: "pending",
          called: false,
          pendingBy: getRepName(),
          pendingById: getRepId(),
          pendingAt: entry.pendingAt || new Date().toISOString(),
          businessName: existing?.businessName || entry.businessName || "",
        };
      });
    } catch (e) {
      /* ignore */
    }
  }

  function isPendingByMe(lead) {
    const s = statusEntry(lead.id);
    if (!s || s.workflow !== "pending") return false;
    return isOwnerMatch(s.pendingById || s.calledById, s.pendingBy || s.calledBy);
  }

  function getMyPendingLeads() {
    const byId = new Map(allLeads.map((l) => [String(l.id), l]));
    const out = [];
    const seen = new Set();

    Object.entries(statusMap).forEach(([id, entry]) => {
      const sid = String(id);
      if (entry?.workflow !== "pending" || seen.has(sid)) return;
      if (!isOwnerMatch(entry.pendingById || entry.calledById, entry.pendingBy || entry.calledBy)) {
        return;
      }
      seen.add(sid);
      out.push(byId.get(sid) || leadFromStatusEntry(sid, entry));
    });

    if (!global.LeadSync?.isConfigured?.()) {
      allLeads.forEach((lead) => {
        const sid = String(lead.id);
        if (isPendingByMe(lead) && !seen.has(sid)) {
          seen.add(sid);
          out.push(lead);
        }
      });
    }

    return out.sort((a, b) => {
      const atA = String(statusEntry(a.id)?.pendingAt || statusEntry(a.id)?.calledAt || "");
      const atB = String(statusEntry(b.id)?.pendingAt || statusEntry(b.id)?.calledAt || "");
      if (atA !== atB) return atB.localeCompare(atA);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function filterPendingLeads(pool) {
    return (pool || []).filter((lead) => isPendingByMe(lead));
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

  const PHONE_RE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

  function telHref(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "tel:+1" + digits;
    if (digits.length === 11 && digits[0] === "1") return "tel:+" + digits;
    return digits.length >= 7 ? "tel:+" + digits : "";
  }

  function cleanPhoneLabel(lead, fallback) {
    const raw = String(lead?.phone || fallback || "").trim();
    const match = raw.match(PHONE_RE);
    if (match) return match[0];
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) {
      const d10 = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits.slice(-10);
      return "(" + d10.slice(0, 3) + ") " + d10.slice(3, 6) + "-" + d10.slice(6);
    }
    return "";
  }

  function cleanCategoryLabel(lead, fallback) {
    const biz = businessName(lead).trim();
    const bizLow = biz.toLowerCase();
    const grp = String(lead?.categoryGroup || "").trim();
    if (
      grp &&
      grp.length <= 36 &&
      grp.toLowerCase() !== bizLow &&
      !/no reviews?/i.test(grp)
    ) {
      return grp;
    }

    let v = String(fallback || "").trim();
    if (!v || v === "Category not listed" || v === "NULL") return "";

    v = v
      .replace(/\bno reviews?\b/gi, " ")
      .replace(/\b\d+\s+reviews?\b/gi, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();

    if (biz && v.toLowerCase().startsWith(bizLow)) {
      v = v.slice(biz.length).trim().replace(/^[\s·•\-–]+/, "");
    }

    const tail = v.match(
      /([A-Za-z][\w\s&'/.-]*(?:service|center|centre|tutoring|school|salon|clinic|gym|studio|shop|store|agency))\s*$/i
    );
    if (tail) v = tail[1].trim();

    if (!v || v.toLowerCase() === bizLow || v.length > 40) return "";
    return v;
  }

  function businessName(lead) {
    const d = display();
    const fromLead = d.formatName ? d.formatName(lead) : String(lead.name || "").trim();
    const fromStatus = String(statusEntry(lead.id)?.businessName || "").trim();
    return fromLead || fromStatus || "Business";
  }

  async function ensureSyncApi() {
    if (syncApi?.setWorkflow) return syncApi;
    if (!global.LeadSync?.init) return null;
    syncApi = await global.LeadSync.init(applyStatusMap);
    return syncApi;
  }

  async function setWorkflow(leadId, workflow, name) {
    const id = String(leadId || "").trim();
    if (!id) return;
    const before = { ...statusMap };
    const prev = statusMap[id] || {};
    const now = new Date().toISOString();
    const next = { ...statusMap };

    if (workflow === "active") {
      global.PendingLeadBuilder?.clear?.(id);
      delete next[id];
    } else if (workflow === "not-interested") {
      global.PendingLeadBuilder?.clear?.(id);
      next[id] = {
        workflow: "not-interested",
        called: false,
        calledBy: getRepName(),
        calledById: getRepId(),
        calledAt: now,
        businessName: String(name || prev.businessName || "").trim(),
      };
      delete next[id].pendingAt;
    } else {
      return;
    }

    statusMap = next;
    render();

    try {
      if (workflow === "active") {
        const api = await ensureSyncApi();
        if (!api?.setWorkflow) throw new Error("Lead sync unavailable");
        await api.setWorkflow(id, "active", name);
      } else if (workflow === "not-interested") {
        global.LeadSync?.clearPendingLocalSnapshot?.(id);
        const api = await ensureSyncApi();
        if (!api?.setWorkflow) throw new Error("Lead sync unavailable");
        await api.setWorkflow(id, "not-interested", name);
      }
      if (document.body.dataset.page === "leads") {
        global.LeadsPage?.applyFilters?.();
      }
    } catch (e) {
      statusMap = before;
      render();
      console.error(e);
      alert("Could not update lead. Try again.");
    }
  }

  function applyStatusMap(map) {
    statusMap = map || {};
    mergeLocalPendingOverlay();
    scheduleRender();
  }

  function stagePendingLead(lead) {
    if (!lead) return;
    const id = String(lead.id || "").trim();
    if (!id) return;

    if (!allLeads.some((item) => String(item.id) === id)) {
      allLeads = [...allLeads, lead];
    }

    const prev = statusMap[id] || {};
    statusMap = {
      ...statusMap,
      [id]: {
        ...prev,
        workflow: "pending",
        called: false,
        pendingBy: getRepName(),
        pendingById: getRepId(),
        pendingAt: prev.pendingAt || new Date().toISOString(),
        businessName: String(lead.name || prev.businessName || "").trim(),
      },
    };

    clearTimeout(refreshTimer);
    ready = true;
    render();
  }

  function openPendingToggle(force) {
    const card = $("dash-pending-section");
    if (!card) return;
    if (!force && location.hash !== "#pending") return;

    if (global.setDashboardToggleCardOpen) {
      global.setDashboardToggleCardOpen(card, true, {
        panelId: "dash-pending-panel",
        buttonId: "dash-pending-toggle",
        labelId: "dash-pending-toggle-label",
      });
      return;
    }

    if (card.classList.contains("is-open")) {
      if (force) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    card.classList.add("is-open");
    $("dash-pending-panel")?.setAttribute("aria-hidden", "false");
    $("dash-pending-toggle")?.setAttribute("aria-expanded", "true");
    const label = $("dash-pending-toggle-label");
    if (label) label.textContent = "Hide";
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showPendingForLead(lead) {
    if (!started) start();
    stagePendingLead(lead);
    openPendingToggle(true);
  }

  function pendingSublineHtml(parts, extraClass) {
    const bits = parts.filter((p) => String(p || "").trim());
    if (!bits.length) return "";
    const cls = extraClass ? "dash-pending-subline " + extraClass : "dash-pending-subline";
    return (
      '<p class="' +
      cls +
      '">' +
      bits
        .map((p) => "<span>" + esc(p) + "</span>")
        .join('<span class="dash-pending-dot" aria-hidden="true">·</span>') +
      "</p>"
    );
  }

  function renderPendingMenu(id) {
    return (
      '<div class="dash-pending-menu-wrap">' +
      '<button type="button" class="dash-pending-icon-btn dash-pending-menu-btn" aria-label="More actions" aria-haspopup="true" aria-expanded="false">' +
      '<span data-icon="circle-menu" data-icon-class="dash-pending-ico"></span>' +
      "</button>" +
      '<div class="dash-pending-menu" role="menu" hidden>' +
      '<button type="button" class="dash-pending-menu-item" role="menuitem" data-dash-cancel-pending="' +
      id +
      '">Cancel</button>' +
      '<button type="button" class="dash-pending-menu-item dash-pending-menu-item--muted" role="menuitem" data-dash-not-interested-pending="' +
      id +
      '">Not interested</button>' +
      "</div></div>"
    );
  }

  function clearPendingMenuPosition(menu) {
    if (!menu) return;
    menu.classList.remove("dash-pending-menu--fixed");
    menu.style.removeProperty("top");
    menu.style.removeProperty("left");
    menu.style.removeProperty("right");
    menu.style.removeProperty("width");
    menu.style.removeProperty("height");
    menu.style.removeProperty("max-height");
    menu.style.removeProperty("min-width");
  }

  function positionPendingMenu(wrap) {
    const btn = wrap?.querySelector(".dash-pending-menu-btn");
    const menu = wrap?.querySelector(".dash-pending-menu");
    if (!btn || !menu || menu.hidden) return;

    menu.classList.add("dash-pending-menu--fixed");
    menu.style.width = "max-content";
    menu.style.height = "auto";
    menu.style.maxHeight = "none";
    menu.style.minWidth = "148px";

    const btnRect = btn.getBoundingClientRect();
    const menuW = menu.offsetWidth || 148;
    const menuH = menu.offsetHeight || 72;
    const gap = 4;
    const pad = 8;

    let top = btnRect.bottom + gap;
    let left = btnRect.right - menuW;

    if (top + menuH > window.innerHeight - pad) {
      top = Math.max(pad, btnRect.top - gap - menuH);
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));

    menu.style.top = top + "px";
    menu.style.left = left + "px";
    menu.style.right = "auto";
  }

  function closeAllPendingMenus() {
    document.querySelectorAll(".dash-pending-menu-wrap.is-open").forEach((wrap) => {
      wrap.classList.remove("is-open");
      const menu = wrap.querySelector(".dash-pending-menu");
      menu?.setAttribute("hidden", "");
      clearPendingMenuPosition(menu);
      wrap.querySelector(".dash-pending-menu-btn")?.setAttribute("aria-expanded", "false");
    });
  }

  function syncPendingLoadState() {
    const section = $("dash-pending-section");
    if (!section) return;
    const loading = !ready || loadingPending;
    section.classList.toggle("dash-pending-loading", loading);
    section.classList.toggle("dash-pending-ready", ready && !loadingPending);
    const loadEl = $("dash-pending-load");
    if (loadEl) loadEl.setAttribute("aria-hidden", loading ? "false" : "true");
  }

  function openPendingToggleIfHash() {
    openPendingToggle(false);
  }

  function render() {
    const section = $("dash-pending-section");
    if (!section) return;

    const list = $("dash-pending-list");
    const empty = $("dash-pending-empty");
    const countEl = $("dash-pending-count");
    const pool = getMyPendingLeads();
    const pending = filterPendingLeads(pool);
    const showEmpty = pending.length === 0;

    section.classList.toggle("dash-pending-section--empty", showEmpty);

    if (countEl) {
      countEl.textContent = pool.length === 1 ? "1 pending" : pool.length + " pending";
    }

    if (!list) return;

    if (showEmpty) {
      list.innerHTML = "";
      list.hidden = true;
      if (empty) {
        empty.hidden = false;
        const title = empty.querySelector(".dash-empty-title");
        const desc = empty.querySelector(".dash-empty-desc");
        if (title) title.textContent = "No pending leads";
        if (desc) {
          desc.innerHTML = emptyPendingDescHtml();
        }
      }
      if (ready) syncPendingLoadState();
      openPendingToggleIfHash();
      return;
    }

    if (empty) empty.hidden = true;
    list.hidden = false;

    list.innerHTML = pending
      .map((lead) => {
        const id = esc(lead.id);
        const name = esc(businessName(lead));
        const entry = statusEntry(lead.id) || {};
        const whenIso = String(entry.pendingAt || entry.calledAt || "").trim();
        const when = formatTimeAgo(whenIso);
        const phone = String(lead.phone || "").trim();
        const tel = telHref(phone);
        const d = display();
        const phoneLabel = d.formatPhone ? d.formatPhone(lead) : phone || "";
        const phoneDisplay = cleanPhoneLabel(lead, phoneLabel);
        const cat = d.formatCategory ? d.formatCategory(lead) : String(lead.categoryGroup || lead.category || "").trim();
        const catLabel = cleanCategoryLabel(lead, cat);
        const mapsUrl = String(lead.mapsUrl || "").trim();
        const builder = global.PendingLeadBuilder?.get?.(lead.id);
        const priceLabel = builder?.price || "";
        const ownerLabel = String(builder?.ownerName || "").trim();
        const prefLabel = String(builder?.preference || "").trim();
        const mainBits = [];
        if (when) {
          mainBits.push(
            '<time class="dash-pending-time" datetime="' + esc(whenIso) + '">' + esc(when) + "</time>"
          );
        }
        if (catLabel) mainBits.push("<span>" + esc(catLabel) + "</span>");
        if (priceLabel) mainBits.push('<span class="dash-pending-price">' + esc(priceLabel) + "</span>");
        if (phoneDisplay) mainBits.push("<span>" + esc(phoneDisplay) + "</span>");
        const mainHtml = mainBits.length
          ? '<p class="dash-pending-subline">' +
            mainBits.join('<span class="dash-pending-dot" aria-hidden="true">·</span>') +
            "</p>"
          : "";

        const detailLine = [];
        if (ownerLabel) detailLine.push(ownerLabel);
        if (prefLabel) detailLine.push(prefLabel);

        return (
          '<li class="dash-pending-item">' +
          '<div class="dash-pending-item-body">' +
          '<p class="dash-pending-name">' +
          name +
          "</p>" +
          mainHtml +
          pendingSublineHtml(detailLine, "dash-pending-subline--detail") +
          "</div>" +
          '<div class="dash-pending-item-actions">' +
          (tel
            ? '<a class="dash-pending-icon-btn" href="' +
              esc(tel) +
              '" title="Call" aria-label="Call"><span data-icon="phone" data-icon-class="dash-pending-ico"></span></a>'
            : "") +
          (mapsUrl && mapsUrl !== "#"
            ? '<a class="dash-pending-icon-btn" href="' +
              esc(mapsUrl) +
              '" target="_blank" rel="noopener noreferrer" title="Maps" aria-label="Open in Maps"><span data-icon="map-pin" data-icon-class="dash-pending-ico"></span></a>'
            : "") +
          renderPendingMenu(id) +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    if (global.SiteIcons) global.SiteIcons.initIcons(section);
    syncPendingLoadState();
    openPendingToggleIfHash();
  }

  function bindPendingActions() {
    const section = $("dash-pending-section");
    if (!section || section.dataset.actionsBound === "1") return;
    section.dataset.actionsBound = "1";

    if (!global._dashPendingMenuBound) {
      global._dashPendingMenuBound = true;
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".dash-pending-menu-wrap")) closeAllPendingMenus();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllPendingMenus();
      });
      document.addEventListener(
        "scroll",
        () => {
          if (document.querySelector(".dash-pending-menu-wrap.is-open")) closeAllPendingMenus();
        },
        { passive: true, capture: true }
      );
    }

    section.addEventListener("click", (e) => {
      const menuBtn = e.target.closest(".dash-pending-menu-btn");
      if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = menuBtn.closest(".dash-pending-menu-wrap");
        const panel = wrap?.querySelector(".dash-pending-menu");
        if (!wrap || !panel) return;
        const open = wrap.classList.contains("is-open");
        closeAllPendingMenus();
        if (!open) {
          wrap.classList.add("is-open");
          panel.hidden = false;
          menuBtn.setAttribute("aria-expanded", "true");
          positionPendingMenu(wrap);
        }
        return;
      }

      const cancelBtn = e.target.closest("[data-dash-cancel-pending]");
      if (cancelBtn) {
        e.preventDefault();
        closeAllPendingMenus();
        const id = cancelBtn.getAttribute("data-dash-cancel-pending");
        const lead = getMyPendingLeads().find((l) => String(l.id) === String(id));
        if (!id || !lead) return;
        void setWorkflow(id, "active", businessName(lead));
        return;
      }

      const niBtn = e.target.closest("[data-dash-not-interested-pending]");
      if (niBtn) {
        e.preventDefault();
        closeAllPendingMenus();
        const id = niBtn.getAttribute("data-dash-not-interested-pending");
        const lead = getMyPendingLeads().find((l) => String(l.id) === String(id));
        if (!id || !lead) return;
        void setWorkflow(id, "not-interested", businessName(lead));
      }
    });
  }

  function applyLocalPendingOverlay() {
    mergeLocalPendingOverlay();
    scheduleRender();
  }

  function scheduleBackgroundRefresh() {
    clearTimeout(backgroundRefreshTimer);
    backgroundRefreshTimer = setTimeout(() => {
      backgroundRefreshTimer = null;
      refresh({ silent: true });
    }, 450);
  }

  function scheduleRender() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (ready) render();
    }, 80);
  }

  async function loadData() {
    ready = false;
    syncPendingLoadState();

    if (!getRepId()) {
      ready = true;
      statusMap = {};
      render();
      return;
    }

    const loader = global.LeadsLoader;
    const cached = loader?.peekCache?.();
    if (cached?.leads?.length) {
      allLeads = cached.leads;
    } else if (loader?.load) {
      try {
        const result = await loader.load();
        allLeads = result.leads || [];
      } catch (e) {
        console.warn("Dashboard pending: could not load leads", e);
        allLeads = [];
      }
    }

    if (unsubSync) {
      unsubSync();
      unsubSync = null;
    }

    if (global.LeadSync?.addUpdateListener) {
      unsubSync = global.LeadSync.addUpdateListener(applyStatusMap);
    }

    if (global.LeadSync?.init) {
      try {
        syncApi = await global.LeadSync.init(applyStatusMap);
        if (global.LeadSync.refreshTeam) {
          await global.LeadSync.refreshTeam();
        }
      } catch (e) {
        console.warn("Dashboard pending: sync unavailable", e);
        mergeLocalPendingOverlay();
        scheduleRender();
      }
    } else {
      mergeLocalPendingOverlay();
    }

    ready = true;
    render();
  }

  function refresh(options) {
    if (!isPendingHostPage()) return;
    if (!getRepId()) return;
    if (!started) {
      start();
      return;
    }
    const showLoading = !!options?.forceLoading;
    if (global.LeadSync?.refreshTeam) {
      if (showLoading) {
        loadingPending = true;
        syncPendingLoadState();
      }
      global.LeadSync.refreshTeam()
        .catch((e) => {
          console.warn("Dashboard pending: refresh failed", e);
        })
        .finally(() => {
          if (showLoading) {
            loadingPending = false;
            syncPendingLoadState();
          }
        });
      return;
    }
    if (!options?.silent) loadData();
  }

  function start() {
    if (!isPendingHostPage() || !$("dash-pending-section")) return;
    if (!getRepId()) return;

    window.initDashboardToggleCards?.();

    bindPendingActions();

    if (started) {
      scheduleBackgroundRefresh();
      return;
    }
    started = true;
    loadData();
  }

  function init() {
    const run = () => {
      if (global.RepStorage?.whenReady) {
        global.RepStorage.whenReady(start);
      } else {
        start();
      }
    };

    if (global.SiteLock?.whenUnlocked) {
      global.SiteLock.whenUnlocked(run);
    } else {
      run();
    }

    global.addEventListener("site-unlocked", run);
    global.addEventListener("rep-session-changed", () => {
      started = false;
      syncApi = null;
      if (unsubSync) {
        unsubSync();
        unsubSync = null;
      }
      run();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleBackgroundRefresh();
    });

    global.addEventListener("pageshow", (e) => {
      if (e.persisted) scheduleBackgroundRefresh();
    });

    global.addEventListener("rep-settings-synced", applyLocalPendingOverlay);
    global.addEventListener("hashchange", openPendingToggleIfHash);
  }

  global.DashboardPending = {
    init,
    refresh,
    render,
    stagePendingLead,
    showPendingForLead,
    openToggle: openPendingToggle,
    cancelPending: (id, name) => setWorkflow(id, "active", name),
  };

  if (isPendingHostPage()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(window);
