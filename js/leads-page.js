(function (global) {
  let allLeads = [];
  let meta = {};
  let statusMap = {};
  let visible = [];
  /** @type {'default' | 'complete' | 'pending' | 'flagged' | 'removed'} */
  let listView = "default";

  const WORKFLOW_VIEWS = [
    { value: "default", label: "Active" },
    { value: "complete", label: "Completed" },
    { value: "pending", label: "Pending" },
    { value: "flagged", label: "Flagged" },
    { value: "removed", label: "Removed" },
  ];
  const PREFS_KEY = "lpc_lead_finder_prefs_v1";
  const DEFAULT_PREFS = { websiteFilter: "noweb", listView: "default" };
  const WEBSITE_FILTERS = ["web", "noweb", "all"];
  /** @type {{ setWorkflow: (id: string, workflow: string, name?: string) => Promise<void> } | null} */
  let syncApi = null;
  let menuDocBound = false;

  const $ = (id) => document.getElementById(id);

  function repScopedKey(base) {
    const id = global.RepSession?.get?.()?.id;
    return id ? "lpc_rep_" + id + "_" + base : base;
  }

  function loadPrefs() {
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(PREFS_KEY)
        : localStorage.getItem(repScopedKey(PREFS_KEY));
      if (!raw) return { ...DEFAULT_PREFS };
      const p = JSON.parse(raw);
      return {
        websiteFilter: WEBSITE_FILTERS.includes(p.websiteFilter)
          ? p.websiteFilter
          : DEFAULT_PREFS.websiteFilter,
        listView: WORKFLOW_VIEWS.some((w) => w.value === p.listView)
          ? p.listView
          : DEFAULT_PREFS.listView,
      };
    } catch (e) {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs() {
    const prefs = {
      websiteFilter: getWebsiteFilter(),
      listView,
    };
    const json = JSON.stringify(prefs);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(PREFS_KEY, json);
    else localStorage.setItem(repScopedKey(PREFS_KEY), json);
  }

  function applyPrefsToUi() {
    const prefs = loadPrefs();
    listView = prefs.listView;
    document.querySelectorAll(".lf-website-toggle .lf-toggle-btn").forEach((b) => {
      const on = b.dataset.filter === prefs.websiteFilter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const sel = $("lf-workflow-view");
    if (sel) sel.value = listView;
  }

  function getLeadWorkflow(lead) {
    const s = statusMap[lead.id];
    if (s?.workflow) return s.workflow;
    if (s?.called) return "complete";
    if (window.LeadSync?.isConfigured?.()) return "";
    return lead.called ? "complete" : "";
  }

  function isRemoved(lead) {
    return getLeadWorkflow(lead) === "removed";
  }

  function isCompleted(lead) {
    return getLeadWorkflow(lead) === "complete";
  }

  function isDefaultLead(lead) {
    return !getLeadWorkflow(lead);
  }

  function matchesWorkflowView(lead) {
    const workflow = getLeadWorkflow(lead);
    if (listView === "default") return isDefaultLead(lead);
    return workflow === listView;
  }

  function countWorkflowView(view) {
    return allLeads.filter((lead) => {
      if (view === "default") return isDefaultLead(lead);
      return getLeadWorkflow(lead) === view;
    }).length;
  }

  function workflowLabel(workflow) {
    if (workflow === "complete") return "Complete";
    if (workflow === "pending") return "Pending";
    if (workflow === "flagged") return "Flagged";
    if (workflow === "removed") return "Removed";
    return "";
  }

  function workflowChipClass(workflow) {
    if (workflow === "complete") return "lf-status-chip-done";
    if (workflow === "pending") return "lf-status-chip-pending";
    if (workflow === "flagged") return "lf-status-chip-flagged";
    return "lf-status-chip-muted";
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function display() {
    return window.LeadDisplay || {};
  }

  function formatRatingParts(lead) {
    const d = display();
    const rating = d.formatRating ? d.formatRating(lead) : "";
    const reviews = d.formatReviews ? d.formatReviews(lead) : "";
    const line = d.formatRatingLine ? d.formatRatingLine(lead) : "";
    return { rating, reviews, line, hasData: !!(rating || reviews) };
  }

  function compareWithinGroup(a, b) {
    // Keep it simple: no-website first, then highest rated, then name.
    if (a.hasWebsite !== b.hasWebsite) return a.hasWebsite ? 1 : -1;
    const r = (b.rating || 0) - (a.rating || 0);
    if (r) return r;
    return (a.name || "").localeCompare(b.name || "");
  }

  function getWebsiteFilter() {
    const active = document.querySelector(".lf-website-toggle .lf-toggle-btn.active");
    const v = active?.dataset.filter || "noweb";
    if (v === "web" || v === "all") return v;
    return "noweb";
  }

  function getFilters() {
    return {
      websiteFilter: getWebsiteFilter(),
    };
  }

  function matchesWebsiteFilter(lead, websiteFilter) {
    if (websiteFilter === "noweb") return !lead.hasWebsite;
    if (websiteFilter === "web") return !!lead.hasWebsite;
    return true;
  }

  function countCompleted() {
    return allLeads.filter((l) => isCompleted(l)).length;
  }

  function applyFilters() {
    const f = getFilters();

    visible = allLeads.filter((lead) => {
      if (!matchesWebsiteFilter(lead, f.websiteFilter)) return false;
      return matchesWorkflowView(lead);
    });

    visible.sort(compareWithinGroup);

    const grid = $("lf-grid");
    if (grid) delete grid.dataset.renderSig;
    updateViewUi();
    renderGrid();
    updateStats();
  }

  function updateViewUi() {
    const sel = $("lf-workflow-view");
    if (!sel) return;
    WORKFLOW_VIEWS.forEach(({ value, label }) => {
      const opt = sel.querySelector('option[value="' + value + '"]');
      if (!opt) return;
      const n = countWorkflowView(value);
      opt.textContent = n > 0 ? label + " (" + n + ")" : label;
    });
    sel.value = listView;
  }

  function updateCount() {
    const showingEl = $("lf-stat-showing");
    const hintEl = $("lf-count");
    const n = visible.length;
    if (showingEl) showingEl.textContent = String(n);

    if (!hintEl) return;
    if (n === 0 && allLeads.length > 0) {
      const f = getWebsiteFilter();
      const hint =
        f === "noweb"
          ? "No leads without a website — try Website or All."
          : f === "web"
            ? "No leads with a website — try No website or All."
            : listView === "complete"
              ? "No completed leads yet."
              : listView === "pending"
                ? "No pending leads."
                : listView === "flagged"
                  ? "No flagged leads."
                  : listView === "removed"
                    ? "No removed leads."
                    : "No active leads.";
      hintEl.textContent = hint;
      hintEl.hidden = false;
      return;
    }
    hintEl.textContent = "";
    hintEl.hidden = true;
  }

  function updateStats() {
    const total = meta.total || allLeads.length;
    if ($("lf-stat-total")) $("lf-stat-total").textContent = String(total);
    if ($("lf-stat-done")) $("lf-stat-done").textContent = String(countCompleted());
    updateCount();
  }

  function valueClass(text) {
    const t = String(text || "").trim();
    if (t === "NULL") return " lf-detail-val-null";
    if (/not listed$/i.test(t)) return " lf-detail-val-missing";
    return "";
  }

  function formatDisplayHours(raw) {
    if (!raw) return "";
    return String(raw)
      .replace(/[\u00b7\u2022]+/g, "·")
      .replace(/\s*·\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function visitWebsiteUrl(lead) {
    const w = String(lead?.website || "").trim();
    if (!w.startsWith("http://") && !w.startsWith("https://")) return "";
    const low = w.toLowerCase();
    if (low.includes("google.com/maps") || low.includes("gstatic.com") || low.includes("google.com/aclk")) {
      return "";
    }
    return w;
  }

  function renderCard(lead) {
    const workflow = getLeadWorkflow(lead);
    const cardMod =
      workflow === "complete"
        ? " lead-card--complete"
        : workflow === "flagged"
          ? " lead-card--flagged"
          : workflow === "pending"
            ? " lead-card--pending"
            : "";
    const d = display();
    const phoneDisplay = d.formatPhone ? d.formatPhone(lead) : lead.phone || "Phone not listed";
    const addr = d.formatAddress ? d.formatAddress(lead) : lead.address || "Address not listed";
    let hours = d.formatHours ? d.formatHours(lead) : lead.hours || "Hours not listed";
    hours = formatDisplayHours(hours);
    const showHours = hours && hours !== "Hours not listed" && hours !== "NULL";
    const bizName = d.formatName ? d.formatName(lead) : lead.name || "Business name not listed";
    const bizCat = d.formatCategory ? d.formatCategory(lead) : lead.category || lead.categoryGroup || "Category not listed";
    const { rating, reviews, line, hasData } = formatRatingParts(lead);
    const avatarText = d.initials ? d.initials(lead) : "?";
    const avatarStyle = d.avatarStyle ? d.avatarStyle(lead) : "";
    const mapsUrl = lead.mapsUrl || "#";
    const websiteUrl = visitWebsiteUrl(lead);
    const phoneRaw = String(lead.phone || "").trim();
    const tel =
      phoneRaw && phoneRaw.toUpperCase() !== "NULL"
        ? phoneRaw.replace(/[^\d+]/g, "")
        : "";

    const statusChip =
      workflow && workflow !== "removed"
        ? `<span class="lf-status-chip ${workflowChipClass(workflow)}">${escapeHtml(workflowLabel(workflow))}</span>`
        : "";

    const ratingHtml = hasData
      ? `<span class="lf-rating-inline" title="Google Maps rating">
          <span data-icon="star" data-icon-class="lf-rating-ico"></span>
          <span>${escapeHtml(line)}</span>
        </span>`
      : "";

    const sublineParts = [escapeHtml(bizCat)];
    if (ratingHtml) sublineParts.push(ratingHtml);

    return `
      <article class="lead-card card${cardMod}" data-id="${escapeHtml(lead.id)}">
        <div class="lf-card-accent" aria-hidden="true"></div>
        <header class="lf-card-top">
          <div class="lf-card-identity">
            <div class="lf-avatar" style="${avatarStyle}" aria-hidden="true">${escapeHtml(avatarText)}</div>
            <div class="lf-card-titles">
              <h3 class="lead-card-name">${escapeHtml(bizName)}</h3>
              <p class="lf-card-subline">${sublineParts.join('<span class="lf-meta-dot" aria-hidden="true">·</span>')}</p>
            </div>
          </div>
          <div class="lf-card-top-actions">
            ${statusChip}
            <div class="lf-card-menu-wrap">
              <button type="button" class="lf-menu-btn" data-lead-id="${escapeHtml(lead.id)}" aria-label="Lead options" aria-haspopup="true" aria-expanded="false">
                <span data-icon="circle-menu" data-icon-class="lf-menu-ico"></span>
              </button>
              <div class="lf-menu-panel" role="menu" hidden>
                ${
                  workflow
                    ? `<button type="button" class="lf-menu-item lf-menu-item-restore" role="menuitem" data-action="active" data-lead-id="${escapeHtml(lead.id)}">Back to Active</button>`
                    : ""
                }
                <button type="button" class="lf-menu-item${workflow === "complete" ? " is-active" : ""}" role="menuitem" data-action="complete" data-lead-id="${escapeHtml(lead.id)}">Complete</button>
                <button type="button" class="lf-menu-item${workflow === "pending" ? " is-active" : ""}" role="menuitem" data-action="pending" data-lead-id="${escapeHtml(lead.id)}">Pending</button>
                <button type="button" class="lf-menu-item${workflow === "flagged" ? " is-active" : ""}" role="menuitem" data-action="flagged" data-lead-id="${escapeHtml(lead.id)}">Flag</button>
                <button type="button" class="lf-menu-item lf-menu-item-danger${workflow === "removed" ? " is-active" : ""}" role="menuitem" data-action="removed" data-lead-id="${escapeHtml(lead.id)}">Remove</button>
              </div>
            </div>
          </div>
        </header>

        <section class="lf-card-body" aria-label="Contact details">
          <ul class="lf-info-list">
            <li class="lf-info-item" aria-label="Phone">
              <span class="lf-info-icon" aria-hidden="true"><span data-icon="phone" data-icon-class="lf-info-ico"></span></span>
              <div class="lf-info-content lf-info-content--phone">
                ${
                  tel
                    ? `<a class="lf-info-text lf-info-link${valueClass(phoneDisplay)}" href="tel:${escapeHtml(tel)}">${escapeHtml(phoneDisplay)}</a>`
                    : `<span class="lf-info-text${valueClass(phoneDisplay)}">${escapeHtml(phoneDisplay)}</span>`
                }
              </div>
            </li>
            <li class="lf-info-item" aria-label="Address">
              <span class="lf-info-icon" aria-hidden="true"><span data-icon="map-pin" data-icon-class="lf-info-ico"></span></span>
              <span class="lf-info-text${valueClass(addr)}">${escapeHtml(addr)}</span>
            </li>
            ${
              showHours
                ? `<li class="lf-info-item" aria-label="Hours">
              <span class="lf-info-icon" aria-hidden="true"><span data-icon="clock" data-icon-class="lf-info-ico"></span></span>
              <span class="lf-info-text lf-info-text--muted${valueClass(hours)}">${escapeHtml(hours)}</span>
            </li>`
                : ""
            }
          </ul>
        </section>

        <footer class="lf-card-actions">
          ${
            websiteUrl
              ? `<a class="lf-action-btn lf-action-web" href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer">
            <span data-icon="globe" data-icon-class="lf-action-ico"></span>
            Website
          </a>`
              : `<span class="lf-action-btn lf-action-web is-disabled" aria-disabled="true">No Website</span>`
          }
          ${
            mapsUrl && mapsUrl !== "#"
              ? `<a class="lf-action-btn lf-action-maps" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer">
            <span data-icon="map-pin" data-icon-class="lf-action-ico"></span>
            Maps
          </a>`
              : `<span class="lf-action-btn lf-action-maps is-disabled" aria-disabled="true">Maps</span>`
          }
        </footer>
      </article>
    `;
  }

  function renderGrid() {
    const grid = $("lf-grid");
    const empty = $("lf-empty");
    if (!grid) return;

    const sig =
      visible.map((l) => l.id + ":" + getLeadWorkflow(l)).join(",") + "|" + listView;

    if (visible.length > 0 && grid.dataset.renderSig === sig) {
      if (empty) empty.hidden = true;
      return;
    }
    grid.dataset.renderSig = sig;

    if (visible.length === 0) {
      grid.innerHTML = "";
    } else {
      grid.innerHTML = visible.map(renderCard).join("");
    }

    if (empty) empty.hidden = visible.length > 0;

    if (window.SiteIcons) window.SiteIcons.initIcons(grid);
    bindCardActions();
  }

  function closeAllMenus() {
    document.querySelectorAll(".lf-card-menu-wrap.is-open").forEach((wrap) => {
      wrap.classList.remove("is-open");
      const btn = wrap.querySelector(".lf-menu-btn");
      const panel = wrap.querySelector(".lf-menu-panel");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    });
  }

  async function applyLeadWorkflow(leadId, workflow) {
    const lead = allLeads.find((l) => l.id === leadId);
    try {
      if (syncApi?.setWorkflow) {
        await syncApi.setWorkflow(leadId, workflow, lead?.name);
      } else {
        const map = { ...statusMap };
        if (workflow === "removed") {
          map[leadId] = { workflow: "removed", called: false };
        } else if (workflow === "pending") {
          map[leadId] = { workflow: "pending", called: false };
        } else if (workflow === "flagged") {
          map[leadId] = { workflow: "flagged", called: false };
        } else if (workflow === "complete") {
          map[leadId] = { workflow: "complete", called: true };
        } else if (workflow === "active") {
          delete map[leadId];
        } else {
          delete map[leadId];
        }
        statusMap = map;
        applyFilters();
      }
    } catch (e) {
      console.error(e);
      alert("Could not save. Check team sync setup or try again.");
    }
  }

  function bindCardActions() {
    document.querySelectorAll(".lf-menu-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const wrap = btn.closest(".lf-card-menu-wrap");
        const panel = wrap?.querySelector(".lf-menu-panel");
        if (!wrap || !panel) return;
        const open = wrap.classList.contains("is-open");
        closeAllMenus();
        if (!open) {
          wrap.classList.add("is-open");
          panel.hidden = false;
          btn.setAttribute("aria-expanded", "true");
        }
      };
    });

    document.querySelectorAll(".lf-menu-item").forEach((item) => {
      item.onclick = async (e) => {
        e.stopPropagation();
        const id = item.dataset.leadId;
        const action = item.dataset.action;
        if (!id || !action) return;
        closeAllMenus();
        await applyLeadWorkflow(id, action);
      };
    });
  }

  function bindMenuDismiss() {
    if (menuDocBound) return;
    menuDocBound = true;
    document.addEventListener("click", closeAllMenus);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllMenus();
    });
  }

  let syncFilterTimer = null;

  function scheduleFilterFromSync(map) {
    statusMap = map || statusMap;
    clearTimeout(syncFilterTimer);
    syncFilterTimer = setTimeout(applyFilters, 300);
  }

  async function loadLeads() {
    const grid = $("lf-grid");
    if (grid) {
      grid.innerHTML = '<p class="leads-loading muted">Loading leads…</p>';
    }
    const loader = window.LeadsLoader;
    if (!loader?.load) throw new Error("LeadsLoader missing");
    const data = await loader.load();
    meta = data.meta || {};
    allLeads = data.leads || [];
    applyFilters();

    if (window.LeadSync) {
      window.LeadSync.init((map) => {
        scheduleFilterFromSync(map);
      })
        .then((api) => {
          syncApi = api;
        })
        .catch((e) => {
          console.warn("Lead sync unavailable, using this device only", e);
        });
    }
  }

  let pageReady = false;

  function init() {
    if (pageReady || document.body.dataset.page !== "leads") return;
    pageReady = true;
    bindMenuDismiss();
    applyPrefsToUi();

    document.querySelector(".lf-website-toggle")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".lf-toggle-btn");
      if (!btn) return;
      document.querySelectorAll(".lf-website-toggle .lf-toggle-btn").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      applyFilters();
      savePrefs();
    });

    $("lf-workflow-view")?.addEventListener("change", (e) => {
      const v = e.target.value;
      if (WORKFLOW_VIEWS.some((w) => w.value === v)) {
        listView = v;
        applyFilters();
        savePrefs();
      }
    });

    window.addEventListener("rep-settings-ready", () => {
      if (document.body.dataset.page !== "leads") return;
      applyPrefsToUi();
      if (allLeads.length) applyFilters();
    });

    loadLeads().catch((err) => {
      const grid = $("lf-grid");
      const msg = escapeHtml(err?.message || String(err));
      const looksLikeSupabase =
        /fetch|network|401|403|jwt|supabase|postgrest|failed to load/i.test(msg);
      if (grid) {
        grid.innerHTML =
          '<div class="leads-error card">' +
          `<p><strong>${looksLikeSupabase ? "Lead Finder could not connect to Supabase." : "Lead Finder could not load leads."}</strong></p>` +
          `<p class="muted">${msg}</p>` +
          (looksLikeSupabase
            ? '<p class="muted">Check: <code>supabase-full-setup.sql</code> was run, leads are imported into the <code>leads</code> table, and <code>js/config.js</code> has your project URL + publishable key. See <code>LEADS_DATABASE.md</code>.</p>'
            : '<p class="muted">Try a hard refresh (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>). If it persists, check the browser console.</p>') +
          "</div>";
      }
      console.error(err);
    });
  }

  function boot() {
    if (global.SiteLock?.whenUnlocked) global.SiteLock.whenUnlocked(init);
    else init();
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState !== "loading") boot();

  window.LeadsPage = { loadLeads, applyFilters };
})(window);
