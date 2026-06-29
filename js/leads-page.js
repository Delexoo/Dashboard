(function (global) {
  let allLeads = [];
  let meta = {};
  let statusMap = {};
  let visible = [];
  /** @type {'default' | 'complete' | 'not-interested' | 'removed' | 'saved'} */
  let listView = "default";

  const WORKFLOW_VIEWS = [
    { value: "default", label: "Active" },
    { value: "saved", label: "Quick Save" },
    { value: "complete", label: "Completed" },
    { value: "not-interested", label: "Not interested" },
    { value: "removed", label: "Removed" },
  ];
  const INITIAL_RENDER_LIMIT = 24;
  const RENDER_INCREMENT = 24;
  const PREFS_KEY = "lpc_lead_finder_prefs_v1";
  const SAVED_KEY = "lpc_lead_saved_v1";
  let savedIds = new Set();
  const DEFAULT_PREFS = {
    websiteFilter: "noweb",
    listView: "default",
    priorityCategories: [],
    reviewsFilter: "all",
  };
  const WEBSITE_FILTERS = ["web", "noweb", "all"];
  const REVIEWS_FILTERS = ["all", "1", "2", "3", "4", "5"];
  // Ordered most-specific first: getBasicCategory() returns the FIRST match,
  // so narrow industries must appear before broad catch-alls.
  const BASIC_CATEGORY_GROUPS = [
    { label: "Childcare", pattern: /daycare|day care|child ?care|preschool|babysit|\bnanny\b/i },
    { label: "Education", pattern: /tutor|teacher|test prep|learning center|driving school|music lesson|\bacademy\b|education/i },
    { label: "Dental", pattern: /dental|dentist|orthodont|endodont|periodont/i },
    { label: "Medical", pattern: /chiropr|doctor|physician|clinic|medical|urgent care|optometr|optician|physical therapy|med spa|dermatolog|pediatric|hospital|surgeon|podiat/i },
    { label: "Beauty", pattern: /salon|barber|\bnail\b|\bhair\b|beauty|\blash|\bbrow\b|makeup|esthetic|waxing|tanning|massage|\bspa\b/i },
    { label: "Pets", pattern: /\bpet\b|\bdog\b|\bcat\b|\bvet\b|veterin|groom|kennel|\banimal\b|aquarium/i },
    { label: "Fitness", pattern: /\bgym\b|fitness|yoga|pilates|crossfit|martial art|karate|taekwondo|\bjiu\b|dance studio|personal train|trainer|workout/i },
    { label: "Food", pattern: /restaurant|cafe|coffee|bakery|\bfood\b|pizza|\bbar\b|grill|\bdeli\b|diner|eatery|catering|caterer|brewery|juice|smoothie|taqueria/i },
    { label: "Auto", pattern: /\bauto\b|\bcar\b|truck|\btire\b|mechanic|detailing|body shop|collision|towing|\btow\b|windshield|oil change|transmission|\btint\b|smog|muffler|\bbrake|\bboat\b|\brv\b|motorcycle|bicycle|bike shop/i },
    { label: "Plumbing", pattern: /plumb|\bdrain\b|sewer|septic|water heater/i },
    { label: "Electrical", pattern: /electric|solar/i },
    { label: "HVAC", pattern: /hvac|heating|air condition|furnace|\bcooling\b/i },
    { label: "Roofing", pattern: /\broof|gutter/i },
    { label: "Landscaping", pattern: /landscap|\blawn\b|\bgarden|\btree\b|irrigation|sprinkler|pest control|exterminat|mosquito|\bsod\b/i },
    { label: "Pool", pattern: /\bpool\b|hot tub/i },
    { label: "Painting", pattern: /paint/i },
    { label: "Cleaning", pattern: /clean|janitor|\bmaid\b|housekeep|pressure wash|power wash/i },
    { label: "Flooring", pattern: /\bfloor|carpet|\btile\b|hardwood|laminate/i },
    { label: "Tech", pattern: /computer|laptop|tech support|\bit services?\b|phone repair|cell phone|electronics|web design|web develop|software|app develop/i },
    { label: "Marketing", pattern: /marketing|advertis|\bseo\b|branding|graphic design|design agency|\bprint\b|sign shop|signage/i },
    { label: "Security", pattern: /security|\balarm\b|surveillance|\bcctv\b|locksmith/i },
    { label: "Moving", pattern: /moving|\bmover|relocation|storage|junk removal|hauling/i },
    { label: "Construction", pattern: /remodel|renovat|construct|contractor|\bbuilder|concrete|masonry|stucco|drywall|dry wall|\bdeck\b|\bfence|cabinet|kitchen|bathroom|countertop|excavat|demolition|paving|asphalt|siding|insulation|installer|installation|framing|foundation/i },
    { label: "Home Repair", pattern: /handyman|\brepair\b|restoration|water damage|\bmold\b|chimney|fireplace|garage door|appliance|inspector|inspection|\bfix\b/i },
    { label: "Real Estate", pattern: /real estate|realtor|\brealty\b|mortgage|\bbroker|property management|home stag|\bstager\b|interior design|architect/i },
    { label: "Finance & Legal", pattern: /insurance|\btax\b|account|bookkeep|attorney|lawyer|\blegal\b|\bnotary\b|financial|\bcpa\b|payroll/i },
    { label: "Events", pattern: /photograph|videograph|wedding|\bevent\b|\bvenue\b|party rental|equipment rental|\brental\b|florist|flower|\bdj\b/i },
    { label: "Senior Care", pattern: /senior|assisted living|home health|home care|caregiver|hospice|\belder/i },
  ];
  /** @type {Set<string>} */
  let priorityCategories = new Set();
  let reviewsFilter = "all";
  /** Free-text search across name, category, address (city/state/ZIP), and phone. */
  let searchQuery = "";
  /** @type {string[]} */
  let searchTokens = [];
  /** @type {{ setWorkflow: (id: string, workflow: string, name?: string) => Promise<void> } | null} */
  let syncApi = null;
  let syncInitPromise = null;
  let menuDocBound = false;
  /** Ignore workflow <select> change while syncing UI to listView (avoids jumping views). */
  let viewSelectSyncing = false;
  let renderLimit = INITIAL_RENDER_LIMIT;
  let lastViewFilterSig = "";
  let loadMoreObserver = null;
  let loadMoreScrollFallbackBound = false;
  let autoLoadQueued = false;

  const $ = (id) => document.getElementById(id);

  function syncWorkflowSelectFromListView() {
    const sel = $("lf-workflow-view");
    if (!sel) return;
    viewSelectSyncing = true;
    try {
      if (sel.value !== listView) sel.value = listView;
    } finally {
      viewSelectSyncing = false;
    }
  }

  function setListView(view, opts) {
    opts = opts || {};
    const v = WORKFLOW_VIEWS.some((w) => w.value === view) ? view : "default";
    listView = v;
    syncWorkflowSelectFromListView();
    if (opts.save) savePrefs();
    if (opts.filter !== false) applyFilters();
  }

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
        listView: (() => {
          const v = p.listView;
          if (v === "pending") return DEFAULT_PREFS.listView;
          return WORKFLOW_VIEWS.some((w) => w.value === v) ? v : DEFAULT_PREFS.listView;
        })(),
        priorityCategories: Array.isArray(p.priorityCategories)
          ? p.priorityCategories.map((c) => String(c || "").trim()).filter(Boolean)
          : DEFAULT_PREFS.priorityCategories,
        reviewsFilter: REVIEWS_FILTERS.includes(p.reviewsFilter)
          ? p.reviewsFilter
          : DEFAULT_PREFS.reviewsFilter,
      };
    } catch (e) {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs() {
    const prefs = {
      websiteFilter: getWebsiteFilter(),
      listView,
      priorityCategories: Array.from(priorityCategories),
      reviewsFilter: getReviewsFilter(),
    };
    const json = JSON.stringify(prefs);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(PREFS_KEY, json);
    else localStorage.setItem(repScopedKey(PREFS_KEY), json);
  }

  function applyPrefsToUi() {
    const prefs = loadPrefs();
    listView = prefs.listView;
    priorityCategories = new Set(prefs.priorityCategories);
    reviewsFilter = prefs.reviewsFilter;
    document
      .querySelectorAll("#lf-website-filter .lf-toggle-btn[data-filter]")
      .forEach((b) => {
        const on = b.dataset.filter === prefs.websiteFilter;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    document.querySelectorAll("#lf-reviews-filter .lf-toggle-btn").forEach((b) => {
      const on = b.dataset.reviewsFilter === prefs.reviewsFilter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    syncWorkflowSelectFromListView();
  }

  function getLeadCategory(lead) {
    const d = display();
    if (d.resolveCategory) return d.resolveCategory(lead);
    return String(lead.categoryGroup || lead.category || "Other").trim() || "Other";
  }

  function getBasicCategory(lead) {
    const rawCategory = getLeadCategory(lead);
    const group = BASIC_CATEGORY_GROUPS.find((item) => item.pattern.test(rawCategory));
    return group ? group.label : "Other";
  }

  function getReviewCount(lead) {
    const n = Number(lead?.reviewCount);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }

  function leadSearchHaystack(lead) {
    return [
      lead.name,
      lead.category,
      lead.categoryGroup,
      lead.titleLine,
      lead.address,
      lead.phone,
      lead.hours,
      lead["W4Efsd 2"],
      lead["W4Efsd 3"],
      lead["W4Efsd 5"],
    ]
      .map((v) => String(v || ""))
      .join(" ")
      .toLowerCase();
  }

  function setSearchQuery(value) {
    const q = String(value || "").trim().toLowerCase();
    if (q === searchQuery) return false;
    searchQuery = q;
    searchTokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return true;
  }

  function matchesSearchQuery(lead) {
    if (!searchTokens.length) return true;
    const hay = leadSearchHaystack(lead);
    const digits = hay.replace(/\D/g, "");
    return searchTokens.every((tok) => {
      if (hay.includes(tok)) return true;
      const tokDigits = tok.replace(/\D/g, "");
      return tokDigits.length >= 3 && digits.includes(tokDigits);
    });
  }

  function matchesReviewsFilter(lead, filter) {
    if (filter === "all") return true;
    const count = getReviewCount(lead);
    const n = parseInt(String(filter), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 5) return count === n;
    return true;
  }

  function getReviewsFilter() {
    const active = document.querySelector(
      "#lf-reviews-filter .lf-toggle-btn.active"
    );
    const v = active?.dataset.reviewsFilter || reviewsFilter || "all";
    return REVIEWS_FILTERS.includes(v) ? v : "all";
  }

  function setReviewsFilterUi(value) {
    reviewsFilter = REVIEWS_FILTERS.includes(value) ? value : "all";
    document.querySelectorAll("#lf-reviews-filter .lf-toggle-btn").forEach((b) => {
      const on = b.dataset.reviewsFilter === reviewsFilter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function togglePriorityCategory(category) {
    const cat = String(category || "").trim();
    if (!cat) return;
    if (priorityCategories.has(cat)) priorityCategories.delete(cat);
    else priorityCategories.add(cat);
    savePrefs();
    applyFilters();
  }

  function buildFilteredLeads(includeCategoryFilter) {
    const f = getFilters();
    const browsable = getBrowsableLeads(f.websiteFilter);
    let leads;
    if (listView === "complete") {
      leads = browsable.filter((lead) => matchesReviewsFilter(lead, f.reviewsFilter));
    } else if (listView === "not-interested") {
      leads = browsable.filter((lead) => matchesReviewsFilter(lead, f.reviewsFilter));
    } else {
      leads = allLeads.filter((lead) =>
        matchesLeadListFilters(lead, f.websiteFilter, f.reviewsFilter)
      );
    }
    if (searchTokens.length) leads = leads.filter(matchesSearchQuery);
    if (includeCategoryFilter) leads = sortLeadsDisplayOrder(leads);
    const valid = leads.filter(isLeadFormatValid);
    const invalid = leads.filter((lead) => !isLeadFormatValid(lead));
    return [...valid, ...invalid];
  }

  function collectCategoryCounts(leads) {
    const counts = new Map();
    leads.filter(isLeadFormatValid).forEach((lead) => {
      const cat = getBasicCategory(lead);
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => {
      const orderA = BASIC_CATEGORY_GROUPS.findIndex((item) => item.label === a[0]);
      const orderB = BASIC_CATEGORY_GROUPS.findIndex((item) => item.label === b[0]);
      const rankA = orderA === -1 ? BASIC_CATEGORY_GROUPS.length : orderA;
      const rankB = orderB === -1 ? BASIC_CATEGORY_GROUPS.length : orderB;
      return rankA - rankB || a[0].localeCompare(b[0]);
    });
  }

  function renderCategoryFilters(filteredLeads) {
    const extra = $("lf-toolbar-extra");
    const wrap = $("lf-category-chips");
    const available = $("lf-category-available");
    if (!extra || !wrap) return;

    const pairs = collectCategoryCounts(filteredLeads);
    const totalAvailable = pairs.reduce((sum, [, count]) => sum + count, 0);
    const enabledAvailable = pairs.reduce((sum, [cat, count]) => {
      return priorityCategories.has(cat) ? sum + count : sum;
    }, 0);
    const availableCount = priorityCategories.size ? enabledAvailable : totalAvailable;
    extra.hidden = !leadsPageReady || pairs.length === 0;
    if (available) {
      available.textContent = pairs.length ? "(" + availableCount + " available)" : "";
    }

    if (!pairs.length) {
      wrap.innerHTML = "";
      return;
    }

    wrap.innerHTML = pairs
      .map(([cat]) => {
        const active = priorityCategories.has(cat);
        return (
          '<button type="button" class="leads-chip' +
          (active ? " is-active" : "") +
          '" data-category="' +
          escapeHtml(cat) +
          '" aria-pressed="' +
          (active ? "true" : "false") +
          '" title="' +
          escapeHtml(
            active
              ? "Show all lead categories"
              : "Show " + cat + " leads"
          ) +
          '">' +
          escapeHtml(cat) +
          "</button>"
        );
      })
      .join("");
  }

  function filtersSig() {
    return (
      getWebsiteFilter() +
      "|" +
      getReviewsFilter() +
      "|" +
      searchQuery +
      "|" +
      Array.from(priorityCategories).sort().join(",")
    );
  }

  function resetRenderLimit() {
    renderLimit = INITIAL_RENDER_LIMIT;
  }

  function renderedVisibleCount() {
    return Math.min(visible.length, renderLimit);
  }

  function visibleRenderSlice() {
    return visible.slice(0, renderedVisibleCount());
  }

  function hasMoreVisibleLeads() {
    return renderedVisibleCount() < visible.length;
  }

  function loadNextVisibleBatch() {
    if (!hasMoreVisibleLeads()) return false;
    renderLimit = Math.min(visible.length, renderLimit + RENDER_INCREMENT);
    renderGrid();
    return true;
  }

  function queueLoadNextVisibleBatch() {
    if (autoLoadQueued) return;
    autoLoadQueued = true;
    const schedule = global.requestAnimationFrame
      ? global.requestAnimationFrame.bind(global)
      : global.setTimeout.bind(global);
    schedule(() => {
      autoLoadQueued = false;
      loadNextVisibleBatch();
    });
  }

  function handleLoadMoreScrollFallback() {
    const sentinel = document.querySelector("[data-lf-load-more-sentinel]");
    if (!sentinel) return;
    const viewportHeight = global.innerHeight || document.documentElement.clientHeight || 0;
    if (sentinel.getBoundingClientRect().top <= viewportHeight + 420) {
      queueLoadNextVisibleBatch();
    }
  }

  function bindLoadMoreScrollFallback() {
    if (loadMoreScrollFallbackBound) return;
    loadMoreScrollFallbackBound = true;
    global.addEventListener("scroll", handleLoadMoreScrollFallback, { passive: true });
    global.addEventListener("resize", handleLoadMoreScrollFallback, { passive: true });
  }

  function normalizeLeadId(id) {
    return String(id ?? "").trim();
  }

  function loadIdSet(key) {
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(key)
        : localStorage.getItem(repScopedKey(key));
      const o = JSON.parse(raw || "{}");
      return new Set(
        Object.keys(o)
          .filter((id) => o[id])
          .map(normalizeLeadId)
          .filter(Boolean)
      );
    } catch (e) {
      return new Set();
    }
  }

  function saveIdSet(key, set) {
    const o = {};
    set.forEach((id) => {
      const sid = normalizeLeadId(id);
      if (sid) o[sid] = true;
    });
    const json = JSON.stringify(o);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(key, json);
    else localStorage.setItem(repScopedKey(key), json);
  }

  function reloadPersonalMarks() {
    savedIds = loadIdSet(SAVED_KEY);
  }

  function isSaved(lead) {
    return savedIds.has(normalizeLeadId(lead.id));
  }

  function syncSaveButtonUi(btn, saved) {
    if (!btn) return;
    btn.classList.toggle("is-on", saved);
    btn.setAttribute("aria-pressed", saved ? "true" : "false");
    btn.setAttribute("aria-label", saved ? "Remove from Quick Save" : "Quick Save");
    btn.title = saved ? "Unlike" : "Quick Save";
    const card = btn.closest(".lead-card");
    if (card) card.classList.toggle("lead-card--saved", saved);
  }

  function invalidateGridRender() {
    const g = $("lf-grid");
    if (g) delete g.dataset.renderSig;
  }

  function toggleSaved(leadId) {
    const id = normalizeLeadId(leadId);
    if (savedIds.has(id)) savedIds.delete(id);
    else savedIds.add(id);
    saveIdSet(SAVED_KEY, savedIds);
  }

  function switchToActiveView() {
    if (listView === "default") return;
    setListView("default", { save: true, filter: false });
  }

  async function handleBuildLeadClick(leadId) {
    const id = normalizeLeadId(leadId);
    const lead = allLeads.find((l) => normalizeLeadId(l.id) === id);
    if (!id || !lead || !canEditLeadStatus(lead)) return;
    if (typeof global.forwardLeadToBuilder === "function") {
      const ok = await global.forwardLeadToBuilder(lead);
      if (!ok) return;
    }
  }

  function telHref(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length === 10) return "tel:+1" + digits;
    if (digits.length === 11 && digits[0] === "1") return "tel:+" + digits;
    return digits.length >= 7 ? "tel:+" + digits : "";
  }

  function leadById(leadId) {
    const id = normalizeLeadId(leadId);
    if (!id) return null;
    const found = allLeads.find((l) => normalizeLeadId(l.id) === id);
    if (found) return found;
    const entry = statusEntry(id);
    if (!entry) return null;
    return leadFromStatusEntry(id, entry, "Pending");
  }

  function getLeadWorkflow(lead) {
    const s = statusEntry(lead.id);
    let w = s?.workflow || (s?.called ? "complete" : "");
    if (w === "flagged") w = "";
    if (w) return w;
    if (window.LeadSync?.isConfigured?.()) return "";
    return lead.called ? "complete" : "";
  }

  function statusEntry(leadId) {
    if (!leadId) return null;
    const direct = statusMap[leadId] || statusMap[String(leadId)];
    if (direct) return direct;
    const target = normalizeLeadId(leadId);
    const key = Object.keys(statusMap).find((k) => normalizeLeadId(k) === target);
    return key ? statusMap[key] : null;
  }

  function isRemoved(lead) {
    return getLeadWorkflow(lead) === "removed";
  }

  function isCompleted(lead) {
    return getLeadWorkflow(lead) === "complete";
  }

  function getRepName() {
    return String(global.RepSession?.getName?.() || "").trim();
  }

  function getRepId() {
    return String(
      global.RepSession?.getId?.() || global.RepSession?.get?.()?.id || ""
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

  function clearStatusEntries(map, leadId) {
    const target = normalizeLeadId(leadId);
    Object.keys(map).forEach((key) => {
      if (normalizeLeadId(key) === target) delete map[key];
    });
  }

  function renderLeadMenuPanel(lead, workflow) {
    const id = escapeHtml(lead.id);
    const saved = isSaved(lead);
    const completeByMe = workflow === "complete" && isCompletedByMe(lead);
    const pendingByMe = workflow === "pending" && isPendingByMe(lead);
    const notInterestedByMe = workflow === "not-interested" && isNotInterestedByMe(lead);
    const removed = workflow === "removed";
    return (
      '<div class="lf-menu-panel" role="menu" hidden>' +
      (workflow
        ? '<button type="button" class="lf-menu-item lf-menu-item-restore" role="menuitem" data-lf-workflow="restore" data-lead-id="' +
          id +
          '">Back to Active</button>'
        : "") +
      '<button type="button" class="lf-menu-item' +
      (saved ? " is-active" : "") +
      '" role="menuitem" data-lf-workflow="save" data-lead-id="' +
      id +
      '">' +
      (saved ? "Unlike" : "Like") +
      "</button>" +
      '<button type="button" class="lf-menu-item' +
      (completeByMe ? " is-active" : "") +
      '" role="menuitem" data-lf-workflow="complete" data-lead-id="' +
      id +
      '">' +
      (completeByMe ? "Unmark complete" : "Complete") +
      "</button>" +
      '<button type="button" class="lf-menu-item' +
      (pendingByMe ? " is-active" : "") +
      '" role="menuitem" data-lf-workflow="pending" data-lead-id="' +
      id +
      '">' +
      (pendingByMe ? "Clear pending" : "Pending") +
      "</button>" +
      '<button type="button" class="lf-menu-item' +
      (notInterestedByMe ? " is-active" : "") +
      '" role="menuitem" data-lf-workflow="not-interested" data-lead-id="' +
      id +
      '">' +
      (notInterestedByMe ? "Clear not interested" : "Not interested") +
      "</button>" +
      '<button type="button" class="lf-menu-item lf-menu-item-danger' +
      (removed ? " is-active" : "") +
      '" role="menuitem" data-lf-workflow="removed" data-lead-id="' +
      id +
      '">' +
      (removed ? "Restore" : "Remove") +
      "</button>" +
      "</div>"
    );
  }

  /** Clicking an active status again clears it (same idea as Like). */
  function resolveMenuWorkflowAction(leadId, action) {
    const act = String(action || "").trim();
    if (act === "restore") return "active";
    if (act === "save") return act;
    const lead = allLeads.find((l) => normalizeLeadId(l.id) === normalizeLeadId(leadId));
    if (!lead) return act;
    const w = getLeadWorkflow(lead);
    if (act === "complete" && w === "complete" && isCompletedByMe(lead)) return "active";
    if (act === "pending" && w === "pending" && isPendingByMe(lead)) return "active";
    if (act === "not-interested" && w === "not-interested" && isNotInterestedByMe(lead)) {
      return "active";
    }
    if (act === "removed" && w === "removed") return "active";
    return act;
  }

  function isCompletedByMe(lead) {
    const s = statusEntry(lead.id);
    if (!s || getLeadWorkflow(lead) !== "complete") return false;
    return isOwnerMatch(s.calledById, s.calledBy);
  }

  function pendingOwnerName(lead) {
    const s = statusEntry(lead.id);
    return String(s?.pendingBy || s?.calledBy || "").trim();
  }

  function isPendingByMe(lead) {
    if (getLeadWorkflow(lead) !== "pending") return false;
    const s = statusEntry(lead.id);
    return isOwnerMatch(s?.pendingById || s?.calledById, pendingOwnerName(lead));
  }

  function isNotInterestedByMe(lead) {
    if (getLeadWorkflow(lead) !== "not-interested") return false;
    const s = statusEntry(lead.id);
    return isOwnerMatch(s?.calledById, s?.calledBy);
  }

  function buildingOwnerName(lead) {
    const s = statusEntry(lead.id);
    return String(s?.buildingBy || s?.calledBy || "").trim();
  }

  function isBuildingByMe(lead) {
    if (getLeadWorkflow(lead) !== "building") return false;
    const s = statusEntry(lead.id);
    return isOwnerMatch(s?.buildingById || s?.calledById, buildingOwnerName(lead));
  }

  /** Building in Lead Builder by a teammate · hidden from this rep's Active list. */
  function isBuildingByOther(lead) {
    if (getLeadWorkflow(lead) !== "building") return false;
    return !isBuildingByMe(lead);
  }

  function isMyBuildingById(leadId) {
    const s = statusEntry(leadId);
    if (!s || s.workflow !== "building") return false;
    return isOwnerMatch(s.buildingById || s.calledById, s.buildingBy || s.calledBy);
  }

  function isLockedByOther(lead) {
    return isPendingByOther(lead) || isBuildingByOther(lead);
  }

  function isWorkingByMe(lead) {
    return isPendingByMe(lead) || isBuildingByMe(lead);
  }

  /** Pending by a teammate · hidden from this rep's callable lists. */
  function isPendingByOther(lead) {
    if (getLeadWorkflow(lead) !== "pending") return false;
    return !isPendingByMe(lead);
  }

  function statusOwnerName(lead) {
    const w = getLeadWorkflow(lead);
    const s = statusEntry(lead.id);
    if (w === "pending") return pendingOwnerName(lead);
    if (w === "complete" || w === "not-interested") {
      return String(s?.calledBy || "").trim();
    }
    if (w === "removed") return getRepName();
    return "";
  }

  function isLeadFormatValid(lead) {
    if (global.LeadCsvFormat?.isValidLead) {
      return global.LeadCsvFormat.isValidLead(lead);
    }
    return lead?.formatValid !== false;
  }

  /** Only the rep who set Pending / Complete / Not interested can change that status. */
  function canEditLeadStatus(lead) {
    if (!isLeadFormatValid(lead)) return false;
    const w = getLeadWorkflow(lead);
    if (!w) return true;
    if (w === "removed") return true;
    const s = statusEntry(lead.id);
    if (w === "pending") {
      return isOwnerMatch(s?.pendingById || s?.calledById, pendingOwnerName(lead));
    }
    if (w === "building") {
      return isOwnerMatch(s?.buildingById || s?.calledById, buildingOwnerName(lead));
    }
    return isOwnerMatch(s?.calledById, s?.calledBy);
  }

  function canEditLeadStatusById(leadId) {
    const lead = allLeads.find((l) => String(l.id) === String(leadId));
    if (lead && !isLeadFormatValid(lead)) return false;
    if (lead) return canEditLeadStatus(lead);
    const s = statusEntry(leadId);
    const w = s?.workflow || (s?.called ? "complete" : "");
    if (!w || w === "removed") return true;
    if (w === "pending") {
      return isOwnerMatch(s?.pendingById || s?.calledById, s?.pendingBy || s?.calledBy);
    }
    if (w === "building") {
      return isOwnerMatch(s?.buildingById || s?.calledById, s?.buildingBy || s?.calledBy);
    }
    return isOwnerMatch(s?.calledById, s?.calledBy);
  }

  function isActiveLead(lead) {
    return !getLeadWorkflow(lead);
  }

  function leadFromStatusEntry(id, entry, categoryLabel) {
    const name = String(entry?.businessName || entry?.business_name || "").trim();
    const cat = categoryLabel || "Team completed";
    return {
      id,
      name: name || "Lead",
      category: cat,
      categoryGroup: cat,
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

  /** All team-complete rows from sync, merged with loaded lead cards. */
  function getCompleteLeadsPool() {
    const byId = new Map(allLeads.map((l) => [String(l.id), l]));
    const out = [];
    const seen = new Set();

    Object.entries(statusMap).forEach(([id, entry]) => {
      const sid = String(id);
      const w = entry?.workflow || (entry?.called ? "complete" : "");
      if (w !== "complete" || seen.has(sid)) return;
      seen.add(sid);
      out.push(byId.get(sid) || leadFromStatusEntry(sid, entry));
    });

    if (!window.LeadSync?.isConfigured?.()) {
      allLeads.forEach((lead) => {
        const sid = String(lead.id);
        if (isCompleted(lead) && !seen.has(sid)) {
          seen.add(sid);
          out.push(lead);
        }
      });
    }

    return sortByCompletedAt(out);
  }

  /** Only this rep's pending leads (team lock still applies in Active for others). */
  function getMyPendingLeadsPool() {
    const byId = new Map(allLeads.map((l) => [String(l.id), l]));
    const out = [];
    const seen = new Set();

    Object.entries(statusMap).forEach(([id, entry]) => {
      const sid = String(id);
      const w = entry?.workflow || "";
      if (w !== "pending" || seen.has(sid)) return;
      if (!isOwnerMatch(entry.pendingById || entry.calledById, entry.pendingBy || entry.calledBy)) {
        return;
      }
      seen.add(sid);
      const lead = byId.get(sid);
      if (lead) out.push(lead);
      else {
        const stub = leadFromStatusEntry(sid, entry);
        stub.category = "Your pending";
        stub.categoryGroup = "Your pending";
        out.push(stub);
      }
    });

    if (!window.LeadSync?.isConfigured?.()) {
      allLeads.forEach((lead) => {
        const sid = String(lead.id);
        if (isPendingByMe(lead) && !seen.has(sid)) {
          seen.add(sid);
          out.push(lead);
        }
      });
    }

    return out
      .slice()
      .sort((a, b) => {
        const atA = String(statusEntry(a.id)?.pendingAt || statusEntry(a.id)?.calledAt || "");
        const atB = String(statusEntry(b.id)?.pendingAt || statusEntry(b.id)?.calledAt || "");
        if (atA !== atB) return atB.localeCompare(atA);
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .filter((lead) => isPendingByMe(lead));
  }

  /** Team-wide · every rep sees businesses marked not interested. */
  function getNotInterestedLeadsPool() {
    const byId = new Map(allLeads.map((l) => [String(l.id), l]));
    const out = [];
    const seen = new Set();

    Object.entries(statusMap).forEach(([id, entry]) => {
      const sid = String(id);
      if (entry?.workflow !== "not-interested" || seen.has(sid)) return;
      seen.add(sid);
      out.push(byId.get(sid) || leadFromStatusEntry(sid, entry, "Not interested"));
    });

    if (!window.LeadSync?.isConfigured?.()) {
      allLeads.forEach((lead) => {
        const sid = String(lead.id);
        if (getLeadWorkflow(lead) === "not-interested" && !seen.has(sid)) {
          seen.add(sid);
          out.push(lead);
        }
      });
    }

    return sortByCompletedAt(out);
  }

  function sortByCompletedAt(leads) {
    return leads.slice().sort((a, b) => {
      const atA = String(statusEntry(a.id)?.calledAt || "");
      const atB = String(statusEntry(b.id)?.calledAt || "");
      if (atA !== atB) return atB.localeCompare(atA);
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function splitCompleteLeads(leads) {
    const mine = [];
    const team = [];
    leads.forEach((lead) => {
      if (isCompletedByMe(lead)) mine.push(lead);
      else team.push(lead);
    });
    return { mine, team };
  }

  function statusSigForLeads(leads) {
    return leads
      .map((l) => {
        const s = statusEntry(l.id) || {};
        return (
          l.id +
          ":" +
          getLeadWorkflow(l) +
          ":" +
          (s.calledBy || "") +
          ":" +
          (s.calledById || "") +
          ":" +
          (s.calledAt || "") +
          ":" +
          (s.pendingBy || "") +
          ":" +
          (s.pendingById || "") +
          ":" +
          (s.pendingAt || "")
        );
      })
      .join(",");
  }

  function isDefaultLead(lead) {
    return isActiveLead(lead);
  }

  function matchesWorkflowView(lead) {
    if (isWorkingByMe(lead) && (listView === "default" || listView === "saved")) {
      return false;
    }
    if (isLockedByOther(lead) && listView !== "complete" && listView !== "not-interested") {
      return false;
    }
    if (listView === "saved") {
      return isSaved(lead) && !isLockedByOther(lead) && getLeadWorkflow(lead) !== "not-interested";
    }
    const workflow = getLeadWorkflow(lead);
    if (listView === "default") {
      return isActiveLead(lead);
    }
    if (listView === "removed") return workflow === "removed";
    return workflow === listView;
  }

  function countWorkflowView(view) {
    const f = getFilters();
    if (view === "complete") {
      return getCompleteLeadsPool().filter((lead) => matchesReviewsFilter(lead, f.reviewsFilter)).length;
    }
    if (view === "not-interested") {
      return getNotInterestedLeadsPool().filter((lead) => matchesReviewsFilter(lead, f.reviewsFilter)).length;
    }
    return allLeads.filter((lead) => {
      if (!matchesWebsiteFilter(lead, f.websiteFilter)) return false;
      if (!matchesReviewsFilter(lead, f.reviewsFilter)) return false;
      if (isWorkingByMe(lead) && (view === "default" || view === "saved")) return false;
      if (view === "saved") {
        return isSaved(lead) && !isLockedByOther(lead) && getLeadWorkflow(lead) !== "not-interested";
      }
      if (view === "default") return isActiveLead(lead);
      if (view === "removed") return getLeadWorkflow(lead) === "removed";
      return getLeadWorkflow(lead) === view;
    }).length;
  }

  function workflowLabel(workflow) {
    if (workflow === "complete") return "Complete";
    if (workflow === "pending") return "Pending";
    if (workflow === "not-interested") return "Not interested";
    if (workflow === "removed") return "Removed";
    return "";
  }

  function workflowChipClass(workflow) {
    if (workflow === "complete") return "lf-status-chip-done";
    if (workflow === "pending") return "lf-status-chip-pending";
    if (workflow === "not-interested") return "lf-status-chip-not-interested";
    return "lf-status-chip-muted";
  }

  function personalMarksSig() {
    return Array.from(savedIds).sort().join(",");
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

  function matchesLeadListFilters(lead, websiteFilter, reviews) {
    if (!matchesWorkflowView(lead)) return false;
    if (!matchesWebsiteFilter(lead, websiteFilter)) return false;
    return matchesReviewsFilter(lead, reviews);
  }

  function shuffleLeads(leads) {
    const rest = leads.slice();
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    return rest;
  }

  function getWebsiteFilter() {
    const active = document.querySelector("#lf-website-filter .lf-toggle-btn.active");
    const v = active?.dataset.filter || "noweb";
    if (v === "web" || v === "all") return v;
    return "noweb";
  }

  function getFilters() {
    return {
      websiteFilter: getWebsiteFilter(),
      reviewsFilter: getReviewsFilter(),
    };
  }

  function getBrowsableLeads(websiteFilter) {
    if (listView === "complete") return getCompleteLeadsPool();
    if (listView === "not-interested") return getNotInterestedLeadsPool();
    const hasPhone = global.LeadDisplay?.hasCallablePhone || global.LeadsLoader?.hasCallablePhone;
    return allLeads.filter((lead) => {
      if (!matchesWorkflowView(lead)) return false;
      if (!matchesWebsiteFilter(lead, websiteFilter)) return false;
      if (hasPhone && !hasPhone(lead)) return false;
      return true;
    });
  }

  function sortLeadsDisplayOrder(leads) {
    if (!priorityCategories.size) return leads;

    return leads.filter((lead) => priorityCategories.has(getBasicCategory(lead)));
  }

  function matchesWebsiteFilter(lead, websiteFilter) {
    if (websiteFilter === "noweb") return !lead.hasWebsite;
    if (websiteFilter === "web") return !!lead.hasWebsite;
    return true;
  }

  function countCompleted() {
    return getCompleteLeadsPool().filter((lead) => isCompletedByMe(lead)).length;
  }

  function applyFilters() {
    const viewFilterSig = listView + "|" + filtersSig();
    if (viewFilterSig !== lastViewFilterSig) {
      resetRenderLimit();
      lastViewFilterSig = viewFilterSig;
    }

    const filterBase = buildFilteredLeads(false);
    visible = buildFilteredLeads(true);

    const grid = $("lf-grid");
    if (grid) delete grid.dataset.renderSig;
    renderCategoryFilters(filterBase);
    updateViewUi();
    renderGrid();
    updateStats();
    manageTeamStatusPoll();
  }

  function updateViewUi() {
    const sel = $("lf-workflow-view");
    if (!sel) return;
    WORKFLOW_VIEWS.forEach(({ value, label }) => {
      const opt = sel.querySelector('option[value="' + value + '"]');
      if (!opt) return;
      const n =
        leadsPageReady && value === listView
          ? visible.length
          : leadsPageReady
            ? countWorkflowView(value)
            : 0;
      opt.textContent = n > 0 ? label + " (" + n + ")" : label;
    });
    syncWorkflowSelectFromListView();
  }

  function setMetricsLoading(loading) {
    const val = loading ? "…" : null;
    ["lf-stat-total", "lf-stat-done"].forEach((id) => {
      const el = $(id);
      if (el && val) el.textContent = val;
    });
  }

  function getAvailableCount() {
    if (!leadsPageReady) return null;
    return allLeads.filter(isLeadFormatValid).length;
  }

  function publishNavCount() {
    const count = getAvailableCount();
    if (count == null) return;
    try {
      sessionStorage.setItem(
        "lpc_lead_finder_nav_count_v1",
        JSON.stringify({ count, at: Date.now() })
      );
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("lead-finder-count-changed", { detail: { count } }));
  }

  function updateStats() {
    if (!leadsPageReady) return;
    if ($("lf-stat-total")) {
      $("lf-stat-total").textContent = String(visible.length);
    }
    if ($("lf-stat-done")) $("lf-stat-done").textContent = String(countCompleted());
    publishNavCount();
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
    if (
      low.includes("google.com/maps") ||
      low.includes("google.com/aclk") ||
      low.includes("gstatic.com")
    ) {
      return "";
    }
    return w;
  }

  function formatWebsiteLabel(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, "");
      return host.length > 32 ? host.slice(0, 29) + "…" : host;
    } catch (e) {
      const s = String(url).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0] || "";
      return s.length > 32 ? s.slice(0, 29) + "…" : s;
    }
  }

  function looksLikeReviewQuote(text) {
    const t = String(text || "").trim();
    if (t.length < 24) return false;
    if (/^["“']/.test(t)) return true;
    return t.split(/\s+/).length >= 6;
  }

  function renderLeadAvatar(lead, extraClass) {
    const d = display();
    const avatarText = d.initials ? d.initials(lead) : "?";
    const avatarStyle = d.avatarStyle ? d.avatarStyle(lead) : "";
    const mod = extraClass ? " " + extraClass : "";
    return (
      '<div class="lf-avatar' +
      mod +
      '" style="' +
      avatarStyle +
      '" aria-hidden="true">' +
      escapeHtml(avatarText) +
      "</div>"
    );
  }

  function renderWebsiteCell(websiteUrl) {
    if (!websiteUrl) {
      return '<span class="lf-website-badge lf-website-badge--none">No website</span>';
    }
    const label = formatWebsiteLabel(websiteUrl);
    return (
      '<a class="lf-website-badge lf-website-badge--yes" href="' +
      escapeHtml(websiteUrl) +
      '" target="_blank" rel="noopener noreferrer" title="' +
      escapeHtml(websiteUrl) +
      '">' +
      escapeHtml(label) +
      "</a>"
    );
  }

  function renderInfoRow(label, icon, valueHtml) {
    return (
      '<li class="lf-info-item" aria-label="' +
      escapeHtml(label) +
      '">' +
      '<span class="lf-info-icon" aria-hidden="true"><span data-icon="' +
      icon +
      '" data-icon-class="lf-info-ico"></span></span>' +
      '<div class="lf-info-value">' +
      valueHtml +
      "</div></li>"
    );
  }

  function formatTimeAgo(iso) {
    if (!iso) return "";
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return "";
    const sec = Math.floor((Date.now() - then.getTime()) / 1000);
    if (sec < 45) return "Just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return min === 1 ? "1 minute ago" : min + " minutes ago";
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr === 1 ? "1 hour ago" : hr + " hours ago";
    const day = Math.floor(hr / 24);
    if (day < 7) return day === 1 ? "1 day ago" : day + " days ago";
    const wk = Math.floor(day / 7);
    if (wk < 5) return wk === 1 ? "1 week ago" : wk + " weeks ago";
    return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function businessDisplayName(lead) {
    const d = display();
    const fromLead = d.formatName ? d.formatName(lead) : lead.name;
    const fromStatus = String(statusEntry(lead.id)?.businessName || "").trim();
    return fromLead || fromStatus || "Business";
  }

  function repAvatarHtml(repName) {
    const name = String(repName || "").trim();
    const RPP = global.RepProfilePhoto;
    const photo =
      (RPP?.urlForRepName && RPP.urlForRepName(name)) ||
      RPP?.DEFAULT_URL ||
      "";
    return (
      '<img class="lf-rep-avatar-img" src="' +
      escapeHtml(photo) +
      '" alt="" width="48" height="48" decoding="async">'
    );
  }

  function renderAnonymousTeamCard(lead, actionLabel) {
    const entry = statusEntry(lead.id) || {};
    const repName = String(entry.calledBy || entry.pendingBy || "").trim() || "Rep";
    const bizName = businessDisplayName(lead);
    const when = formatTimeAgo(entry.calledAt || entry.pendingAt || "");
    const workflow = getLeadWorkflow(lead);
    const canEdit = canEditLeadStatus(lead);
    const label = actionLabel || workflowLabel(workflow) || "Updated";

    const menuHtml = canEdit
      ? `<div class="lf-card-menu-wrap">
          <button type="button" class="lf-menu-btn" data-lead-id="${escapeHtml(lead.id)}" aria-label="Lead options" aria-haspopup="true" aria-expanded="false">
            <span data-icon="circle-menu" data-icon-class="lf-menu-ico"></span>
          </button>
          ${renderLeadMenuPanel(lead, workflow)}
        </div>`
      : "";

    return (
      '<article class="lead-card card lead-card--team-anon lead-card--' +
      escapeHtml(workflow || "complete") +
      '" data-id="' +
      escapeHtml(lead.id) +
      '">' +
      '<div class="lf-team-anon-body">' +
      '<div class="lf-team-anon-rep-col">' +
      '<div class="lf-rep-avatar" aria-hidden="true">' +
      repAvatarHtml(repName) +
      "</div>" +
      '<p class="lf-team-anon-rep">' +
      escapeHtml(repName) +
      "</p>" +
      "</div>" +
      '<div class="lf-team-anon-copy">' +
      '<h3 class="lf-team-anon-business">' +
      escapeHtml(bizName) +
      "</h3>" +
      '<div class="lf-team-anon-meta">' +
      '<span class="lf-team-anon-status lf-team-anon-status--' +
      escapeHtml(workflow || "complete") +
      '">' +
      escapeHtml(label) +
      "</span>" +
      (when ? '<span class="lf-team-anon-when">' + escapeHtml(when) + "</span>" : "") +
      "</div>" +
      "</div>" +
      (menuHtml ? '<div class="lf-team-anon-actions">' + menuHtml + "</div>" : "") +
      "</div>" +
      "</article>"
    );
  }

  function renderFormatErrorCard(lead) {
    const leadId = normalizeLeadId(lead.id);
    const bizName = String(lead.name || lead["qBF1Pd"] || "").trim() || "Unknown lead";
    const formatError = String(lead.formatError || global.LeadCsvFormat?.FORMAT_ERROR || "Format error");
    const avatarHtml = renderLeadAvatar({ ...lead, name: bizName }, "lf-avatar--error");

    return `
      <article class="lead-card card lead-card--format-error" data-id="${escapeHtml(leadId)}" aria-disabled="true">
        <header class="lf-card-top">
          <div class="lf-card-identity">
            ${avatarHtml}
            <div class="lf-card-titles">
              <h3 class="lead-card-name">${escapeHtml(bizName)}</h3>
              <p class="lf-card-subline lf-card-subline--error">${escapeHtml(formatError)}</p>
            </div>
          </div>
          <div class="lf-card-top-actions">
            <span class="lf-status-chip lf-status-chip-format-error">${escapeHtml(formatError)}</span>
          </div>
        </header>

        <section class="lf-card-body" aria-label="Lead status">
          <p class="lf-format-error-copy">This row does not match the Google Maps CSV format. Fix the import or remove the row from the leads table.</p>
        </section>

        <footer class="lf-card-actions lf-card-actions--two">
          <span class="lf-action-btn lf-action-maps is-disabled" aria-disabled="true">
            <span data-icon="map-pin" data-icon-class="lf-action-ico"></span>
            Maps
          </span>
          <span class="lf-action-btn lf-action-builder is-disabled" aria-disabled="true">
            <span data-icon="hammer" data-icon-class="lf-action-ico"></span>
            Build Lead
          </span>
        </footer>
      </article>
    `;
  }

  function renderCard(lead, opts) {
    if (!isLeadFormatValid(lead)) {
      return renderFormatErrorCard(lead);
    }

    opts = opts || {};
    const leadId = normalizeLeadId(lead.id);
    const workflow = getLeadWorkflow(lead);
    const saved = isSaved(lead);
    let cardMod =
      workflow === "complete"
        ? " lead-card--complete"
        : workflow === "pending"
          ? " lead-card--pending"
          : workflow === "not-interested"
            ? " lead-card--not-interested"
            : "";
    if (saved) cardMod += " lead-card--saved";
    const d = display();
    const phoneDisplay = d.formatPhone ? d.formatPhone(lead) : lead.phone || "Phone not listed";
    const addr = d.formatAddress ? d.formatAddress(lead) : lead.address || "Address not listed";
    let hours = d.formatHours ? d.formatHours(lead) : lead.hours || "Hours not listed";
    hours = formatDisplayHours(hours);
    const showHours = hours && hours !== "Hours not listed" && hours !== "NULL";
    const bizName = d.formatName ? d.formatName(lead) : lead.name || "Business name not listed";
    const bizCat = d.formatCategory ? d.formatCategory(lead) : lead.category || lead.categoryGroup || "Category not listed";
    const { rating, reviews, line, hasData } = formatRatingParts(lead);
    const avatarHtml = renderLeadAvatar(lead);
    const reviewQuote = String(lead.reviewQuote || lead["Cw1rxd 2"] || lead["W4Efsd 6"] || "").trim();
    const showQuote = looksLikeReviewQuote(reviewQuote);
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

    const canEditStatus = canEditLeadStatus(lead);

    const phoneStripHtml = tel
      ? `<a class="lf-card-phone" href="tel:${escapeHtml(tel)}"><span data-icon="phone" data-icon-class="lf-card-phone-ico" aria-hidden="true"></span><span class="lf-card-phone-text">${escapeHtml(phoneDisplay)}</span></a>`
      : `<span class="lf-card-phone lf-card-phone--empty"><span data-icon="phone" data-icon-class="lf-card-phone-ico" aria-hidden="true"></span><span class="lf-card-phone-text">${escapeHtml(phoneDisplay)}</span></span>`;

    const infoRows = [
      renderInfoRow("Website", "globe", renderWebsiteCell(websiteUrl)),
      renderInfoRow(
        "Address",
        "map-pin",
        `<span class="lf-info-text lf-info-text--compact${valueClass(addr)}">${escapeHtml(addr)}</span>`
      ),
      renderInfoRow(
        "Reviews",
        "star",
        hasData
          ? `<span class="lf-info-text lf-info-rating">${escapeHtml(line)}</span>`
          : `<span class="lf-info-text lf-info-text--muted">No reviews</span>`
      ),
    ];
    if (showHours) {
      infoRows.push(
        renderInfoRow(
          "Hours",
          "clock",
          `<span class="lf-info-text lf-info-text--muted${valueClass(hours)}">${escapeHtml(hours)}</span>`
        )
      );
    }
    if (showQuote) {
      infoRows.push(
        renderInfoRow(
          "Review",
          "message-square",
          `<span class="lf-info-text lf-info-text--muted lf-info-quote">${escapeHtml(reviewQuote)}</span>`
        )
      );
    }

    const sublineParts = [escapeHtml(bizCat)];
    if (opts.showTeamCompletedBy) {
      const by = String(statusEntry(lead.id)?.calledBy || "").trim();
      sublineParts.push(
        '<span class="lf-completed-by">' +
          (by ? "By " + escapeHtml(by) : "Team") +
          "</span>"
      );
    } else if (opts.completedByLine) {
      sublineParts.push(
        '<span class="lf-completed-by">' + escapeHtml(opts.completedByLine) + "</span>"
      );
    }

    return `
      <article class="lead-card card${cardMod}" data-id="${escapeHtml(leadId)}">
        <header class="lf-card-top">
            <div class="lf-card-identity">
            ${avatarHtml}
            <div class="lf-card-titles">
              <h3 class="lead-card-name">${escapeHtml(bizName)}</h3>
              <p class="lf-card-subline">${sublineParts.join('<span class="lf-meta-dot" aria-hidden="true">·</span>')}</p>
            </div>
          </div>
          <div class="lf-card-top-actions">
            <div class="lf-card-marks" aria-label="Your shortcuts">
              <button type="button" class="lf-mark-btn lf-mark-save${saved ? " is-on" : ""}" data-lead-save="${escapeHtml(leadId)}" aria-label="${saved ? "Remove from Quick Save" : "Quick Save"}" aria-pressed="${saved ? "true" : "false"}" title="Quick Save">
                <span data-icon="heart" data-icon-class="lf-mark-ico"></span>
              </button>
            </div>
            ${statusChip}
            ${
              canEditStatus
                ? `<div class="lf-card-menu-wrap">
              <button type="button" class="lf-menu-btn" data-lead-id="${escapeHtml(lead.id)}" aria-label="Lead options" aria-haspopup="true" aria-expanded="false">
                <span data-icon="circle-menu" data-icon-class="lf-menu-ico"></span>
              </button>
              ${renderLeadMenuPanel(lead, workflow)}
            </div>`
                : ""
            }
          </div>
        </header>

        ${phoneStripHtml}

        <section class="lf-card-body" aria-label="Contact details">
          <ul class="lf-info-list">
            ${infoRows.join("")}
          </ul>
        </section>

        <footer class="lf-card-actions lf-card-actions--two">
          ${
            lead.mapsUrl && lead.mapsUrl !== "#"
              ? `<a class="lf-action-btn lf-action-maps" href="${escapeHtml(lead.mapsUrl)}" target="_blank" rel="noopener noreferrer">
            <span data-icon="map-pin" data-icon-class="lf-action-ico"></span>
            Maps
          </a>`
              : `<span class="lf-action-btn lf-action-maps is-disabled" aria-disabled="true">Maps</span>`
          }
          <button type="button" class="lf-action-btn lf-action-builder${canEditStatus ? "" : " is-disabled"}" data-lead-builder="${escapeHtml(leadId)}" aria-label="Build lead in Lead Builder for ${escapeHtml(bizName)}"${canEditStatus ? "" : " disabled aria-disabled=\"true\""}>
            <span data-icon="hammer" data-icon-class="lf-action-ico"></span>
            Build Lead
          </button>
        </footer>
      </article>
    `;
  }

  function renderCompactCompletedCard(lead, opts) {
    opts = opts || {};
    const entry = statusEntry(lead.id) || {};
    const whenIso = String(entry.calledAt || entry.pendingAt || "").trim();
    const when = formatTimeAgo(whenIso);
    const d = display();
    const bizName = businessDisplayName(lead);
    const bizCat = d.formatCategory ? d.formatCategory(lead) : lead.category || lead.categoryGroup || "";
    const workflow = getLeadWorkflow(lead);
    const canEdit = canEditLeadStatus(lead);
    const leadId = normalizeLeadId(lead.id);
    const tel = telHref(String(lead.phone || "").trim());
    const mapsUrl = lead.mapsUrl && lead.mapsUrl !== "#" ? String(lead.mapsUrl).trim() : "";

    const menuHtml = canEdit
      ? '<div class="lf-card-menu-wrap">' +
        '<button type="button" class="lf-menu-btn lf-complete-icon-btn lf-complete-menu-btn" data-lead-id="' +
        escapeHtml(lead.id) +
        '" aria-label="Lead options" aria-haspopup="true" aria-expanded="false">' +
        '<span data-icon="circle-menu" data-icon-class="lf-complete-ico"></span>' +
        "</button>" +
        renderLeadMenuPanel(lead, workflow) +
        "</div>"
      : "";

    const metaParts = [];
    let avatarHtml;
    if (opts.team) {
      const repName = String(entry.calledBy || entry.pendingBy || "").trim() || "Rep";
      avatarHtml =
        '<div class="lf-rep-avatar lf-complete-row-rep-avatar" aria-hidden="true">' +
        repAvatarHtml(repName) +
        "</div>";
      metaParts.push("<span>" + escapeHtml(repName) + "</span>");
    } else {
      avatarHtml = renderLeadAvatar(lead, "lf-avatar--compact");
      if (bizCat && bizCat !== "Category not listed") {
        metaParts.push("<span>" + escapeHtml(bizCat) + "</span>");
      }
    }
    if (when) {
      metaParts.push(
        '<time class="lf-complete-row-time" datetime="' +
          escapeHtml(whenIso) +
          '">' +
          escapeHtml(when) +
          "</time>"
      );
    }

    const rowMod = opts.team ? " lf-complete-row--team" : " lf-complete-row--mine";

    return (
      '<article class="lf-complete-row' +
      rowMod +
      '" data-id="' +
      escapeHtml(leadId) +
      '">' +
      '<div class="lf-complete-row-avatar">' +
      avatarHtml +
      "</div>" +
      '<div class="lf-complete-row-body">' +
      '<h3 class="lf-complete-row-name">' +
      escapeHtml(bizName) +
      "</h3>" +
      (metaParts.length
        ? '<p class="lf-complete-row-meta">' +
          metaParts.join('<span class="lf-meta-dot" aria-hidden="true">·</span>') +
          "</p>"
        : "") +
      "</div>" +
      '<div class="lf-complete-row-actions">' +
      (tel
        ? '<a class="lf-complete-icon-btn" href="' +
          escapeHtml(tel) +
          '" title="Call" aria-label="Call"><span data-icon="phone" data-icon-class="lf-complete-ico"></span></a>'
        : "") +
      (mapsUrl
        ? '<a class="lf-complete-icon-btn" href="' +
          escapeHtml(mapsUrl) +
          '" target="_blank" rel="noopener noreferrer" title="Maps" aria-label="Open in Maps"><span data-icon="map-pin" data-icon-class="lf-complete-ico"></span></a>'
        : "") +
      menuHtml +
      "</div>" +
      "</article>"
    );
  }

  function renderCompletePane(title, leads, paneClass, cardOpts) {
    cardOpts = cardOpts || {};
    const renderFn =
      cardOpts.renderCard ||
      ((l) => renderCompactCompletedCard(l, cardOpts));
    const emptyMsg = cardOpts.emptyMessage || "No completed leads yet.";
    const desc = cardOpts.paneDesc || "";
    const cards =
      leads.length > 0
        ? leads.map((l) => renderFn(l)).join("")
        : '<p class="lf-complete-empty">' + escapeHtml(emptyMsg) + "</p>";
    return (
      '<section class="lf-complete-pane ' +
      paneClass +
      '" aria-label="' +
      escapeHtml(title) +
      '">' +
      '<header class="lf-complete-pane-head">' +
      '<div class="lf-complete-pane-head-copy">' +
      "<h2 class=\"lf-complete-pane-title\">" +
      escapeHtml(title) +
      "</h2>" +
      (desc ? '<p class="lf-complete-pane-desc">' + escapeHtml(desc) + "</p>" : "") +
      "</div>" +
      '<span class="lf-complete-count" aria-label="' +
      leads.length +
      ' leads">' +
      String(leads.length) +
      "</span>" +
      "</header>" +
      '<div class="lf-complete-pane-grid">' +
      cards +
      "</div>" +
      "</section>"
    );
  }

  function renderCompleteSplit(leads) {
    const { mine, team } = splitCompleteLeads(leads);
    return (
      '<div class="lf-complete-split">' +
      renderCompletePane(
        "Your completed",
        mine,
        "lf-complete-pane--mine",
        {
          paneDesc: "Leads you marked complete",
          emptyMessage: "You haven't completed any leads yet.",
        }
      ) +
      renderCompletePane(
        "Team completed",
        team,
        "lf-complete-pane--team",
        {
          team: true,
          paneDesc: "Completed by teammates",
          emptyMessage: "No team completions yet.",
        }
      ) +
      "</div>"
    );
  }

  function renderLoadMoreSentinel() {
    const rendered = renderedVisibleCount();
    const remaining = visible.length - rendered;
    if (remaining <= 0) return "";
    const next = Math.min(RENDER_INCREMENT, remaining);
    return (
      '<div class="leads-load-more" data-lf-load-more-sentinel aria-live="polite">' +
      '<span class="lf-load-more-status">Loading ' +
      next +
      " more as you scroll...</span>" +
      "</div>"
    );
  }

  function syncLoadMoreObserver(grid) {
    if (loadMoreObserver) {
      loadMoreObserver.disconnect();
      loadMoreObserver = null;
    }
    const sentinel = grid.querySelector("[data-lf-load-more-sentinel]");
    if (!sentinel) return;
    if ("IntersectionObserver" in global) {
      loadMoreObserver = new global.IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            queueLoadNextVisibleBatch();
          }
        },
        { rootMargin: "420px 0px" }
      );
      loadMoreObserver.observe(sentinel);
      return;
    }
    bindLoadMoreScrollFallback();
    handleLoadMoreScrollFallback();
  }

  function renderGrid() {
    const grid = $("lf-grid");
    if (!grid) return;

    let sig = listView + "|" + personalMarksSig() + "|" + filtersSig();
    if (listView === "complete") {
      const split = splitCompleteLeads(visible);
      sig +=
        "|" +
        statusSigForLeads(split.mine) +
        "|" +
        statusSigForLeads(split.team) +
        "|" +
        (global.RepProfilePhoto?.teamPhotosSig?.() || "");
    } else {
      sig += "|" + statusSigForLeads(visible);
      if (listView === "not-interested") {
        sig += "|" + (global.RepProfilePhoto?.teamPhotosSig?.() || "");
      }
    }
    sig += "|render:" + renderLimit;

    if (visible.length > 0 && grid.dataset.renderSig === sig) {
      return;
    }
    grid.dataset.renderSig = sig;

    const rendered = visibleRenderSlice();
    const loadMore = renderLoadMoreSentinel();

    if (listView === "complete") {
      grid.classList.add("leads-grid--complete-split");
      grid.innerHTML = renderCompleteSplit(rendered) + loadMore;
    } else if (listView === "not-interested") {
      grid.classList.remove("leads-grid--complete-split");
      grid.innerHTML = rendered
        .map((l) => renderAnonymousTeamCard(l, "Not interested"))
        .join("") + loadMore;
    } else if (visible.length === 0) {
      grid.innerHTML = "";
      grid.classList.remove("leads-grid--complete-split");
    } else {
      grid.classList.remove("leads-grid--complete-split");
      grid.innerHTML = rendered.map((l) => renderCard(l)).join("") + loadMore;
    }

    if (window.SiteIcons) window.SiteIcons.initIcons(grid);
    syncLoadMoreObserver(grid);
  }

  function clearLfMenuPosition(panel) {
    if (!panel) return;
    panel.classList.remove("lf-menu-panel--fixed");
    panel.style.removeProperty("top");
    panel.style.removeProperty("left");
    panel.style.removeProperty("right");
    panel.style.removeProperty("min-width");
  }

  function positionLfMenu(wrap) {
    const btn = wrap?.querySelector(".lf-menu-btn");
    const panel = wrap?.querySelector(".lf-menu-panel");
    if (!btn || !panel || panel.hidden) return;

    panel.classList.add("lf-menu-panel--fixed");
    const rect = btn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const panelW = panelRect.width || 148;
    const panelH = panelRect.height || 120;
    const gap = 4;
    const pad = 8;

    let top = rect.bottom + gap;
    let left = rect.right - panelW;

    if (top + panelH > window.innerHeight - pad) {
      top = Math.max(pad, rect.top - gap - panelH);
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - panelW - pad));

    panel.style.top = top + "px";
    panel.style.left = left + "px";
    panel.style.right = "auto";
    panel.style.minWidth = Math.max(148, rect.width) + "px";
  }

  function closeAllMenus() {
    document.querySelectorAll(".lf-card-menu-wrap.is-open").forEach((wrap) => {
      wrap.classList.remove("is-open");
      const btn = wrap.querySelector(".lf-menu-btn");
      const panel = wrap.querySelector(".lf-menu-panel");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) {
        panel.hidden = true;
        clearLfMenuPosition(panel);
      }
    });
  }

  function patchStatusMapLocal(leadId, workflow, businessName) {
    const next = { ...statusMap };
    const key = normalizeLeadId(leadId);
    const w = String(workflow || "").trim();
    if (w === "removed") {
      next[key] = { workflow: "removed", called: false };
    } else if (w === "pending") {
      next[key] = {
        workflow: "pending",
        called: false,
        pendingBy: getRepName(),
        pendingById: getRepId(),
        pendingAt: new Date().toISOString(),
      };
    } else if (w === "building") {
      next[key] = {
        workflow: "building",
        called: false,
        buildingBy: getRepName(),
        buildingById: getRepId(),
        buildingAt: new Date().toISOString(),
      };
    } else if (w === "complete") {
      next[key] = {
        workflow: "complete",
        called: true,
        calledBy: getRepName(),
        calledById: getRepId(),
        calledAt: new Date().toISOString(),
      };
    } else if (w === "not-interested") {
      next[key] = {
        workflow: "not-interested",
        called: false,
        calledBy: getRepName(),
        calledById: getRepId(),
        calledAt: new Date().toISOString(),
      };
    } else if (w === "active" || !w) {
      clearStatusEntries(next, leadId);
    }
    if (businessName && next[key]) {
      next[key].businessName = String(businessName).trim();
    }
    statusMap = next;
  }

  function ensureSyncReady() {
    if (syncApi && syncApi.mode === "team") return Promise.resolve(syncApi);
    if (!window.LeadSync) return Promise.resolve(null);
    if (!syncInitPromise) {
      syncInitPromise = window.LeadSync.init((map) => {
        scheduleFilterFromSync(map);
      })
        .then((api) => {
          syncApi = api;
          if (api?.mode === "local" && window.LeadSync?.isConfigured?.()) {
            console.warn(
              "Lead Finder: team sync unavailable · completed/pending are only on this device until Supabase connects."
            );
          }
          return api;
        })
        .catch((e) => {
          syncInitPromise = null;
          throw e;
        });
    }
    return syncInitPromise;
  }

  function retryTeamSync() {
    if (!window.LeadSync?.isConfigured?.()) return Promise.resolve(null);
    if (syncApi?.mode === "team") {
      return window.LeadSync.refreshTeam?.().catch(() => null);
    }
    syncApi = null;
    syncInitPromise = null;
    return ensureSyncReady();
  }

  function consumeForceTeamRefresh() {
    try {
      if (!sessionStorage.getItem("lpc_lf_force_team_refresh_v1")) return Promise.resolve(null);
      sessionStorage.removeItem("lpc_lf_force_team_refresh_v1");
      return retryTeamSync();
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  async function applyLeadWorkflow(leadId, workflow, options) {
    options = options || {};
    const viewBefore = listView;
    const restoreView = options.restoreView !== false;
    const switchToActive = options.switchToActive === true;
    const w = String(workflow || "").trim();
    const inMyPending =
      w === "active" &&
      (getMyPendingLeadsPool().some((l) => normalizeLeadId(l.id) === normalizeLeadId(leadId)) ||
        isMyBuildingById(leadId));
    if (!canEditLeadStatusById(leadId) && !inMyPending) {
      alert(
        "You can only change status on leads you marked Pending, Complete, or Not interested."
      );
      return;
    }
    await ensureSyncReady().catch((e) => {
      console.warn("Lead sync unavailable, using this device only", e);
    });
    const lead = allLeads.find((l) => normalizeLeadId(l.id) === normalizeLeadId(leadId));
    const before = { ...statusMap };
    patchStatusMapLocal(leadId, workflow, lead?.name);
    if (w === "pending") {
      global.LeadSync?.savePendingLocalSnapshot?.(leadId, lead?.name);
    } else if (w === "active" || !w) {
      global.LeadSync?.clearPendingLocalSnapshot?.(leadId);
      global.LeadSync?.clearBuildingLocalSnapshot?.(leadId);
      global.PendingLeadBuilder?.clear?.(normalizeLeadId(leadId));
    } else if (w === "not-interested") {
      global.PendingLeadBuilder?.clear?.(normalizeLeadId(leadId));
    }
    applyFilters();
    try {
      if (syncApi?.setWorkflow) {
        const niDetails =
          w === "not-interested"
            ? {
                phone: String(lead?.phone || "").trim(),
                googleMaps: String(lead?.mapsUrl || "").trim(),
                category: String(lead?.categoryGroup || lead?.category || "").trim(),
                address: String(lead?.address || "").trim(),
              }
            : undefined;
        await syncApi.setWorkflow(leadId, workflow, lead?.name, niDetails);
      }
      if (switchToActive) {
        switchToActiveView();
      } else if (restoreView && listView !== viewBefore) {
        listView = viewBefore;
        syncWorkflowSelectFromListView();
      }
      applyFilters();
      if (w === "complete") {
        const key = normalizeLeadId(leadId);
        const biz =
          String(lead?.name || "").trim() ||
          String(statusMap[key]?.businessName || before[key]?.businessName || "").trim();
        if (global.PendingLeadBuilder?.get?.(key)) {
          global.logSaleFromPendingComplete?.(key, biz);
        }
      }
    } catch (e) {
      statusMap = before;
      if (w === "pending") {
        const key = normalizeLeadId(leadId);
        const hadPending = Object.keys(before).some(
          (k) => normalizeLeadId(k) === key && before[k]?.workflow === "pending"
        );
        if (!hadPending) global.LeadSync?.clearPendingLocalSnapshot?.(leadId);
      }
      if (restoreView && listView !== viewBefore) {
        listView = viewBefore;
        syncWorkflowSelectFromListView();
      }
      applyFilters();
      console.error(e);
      alert("Could not save. Check team sync setup or try again.");
      throw e;
    }
  }

  async function handleMenuWorkflowAction(leadId, action) {
    if (!leadId || !action) return;
    const resolved = resolveMenuWorkflowAction(leadId, action);
    if (resolved === "save") {
      toggleSaved(leadId);
      invalidateGridRender();
      updateViewUi();
      applyFilters();
      return;
    }
    const workflow = resolved === "restore" ? "active" : resolved;
    await applyLeadWorkflow(leadId, workflow, {
      restoreView: true,
      switchToActive: workflow === "active",
    });
    invalidateGridRender();
  }

  function bindGridMarkActions() {
    const grid = $("lf-grid");
    if (!grid || grid.dataset.markActionsBound === "1") return;
    grid.dataset.markActionsBound = "1";

    grid.addEventListener(
      "mousedown",
      (e) => {
        if (e.target.closest(".lf-menu-item[data-lf-workflow]")) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    grid.addEventListener("click", (e) => {
      const menuBtn = e.target.closest(".lf-menu-btn");
      if (menuBtn) {
        e.preventDefault();
        e.stopPropagation();
        $("lf-workflow-view")?.blur();
        const wrap = menuBtn.closest(".lf-card-menu-wrap");
        const panel = wrap?.querySelector(".lf-menu-panel");
        if (!wrap || !panel) return;
        const open = wrap.classList.contains("is-open");
        closeAllMenus();
        if (!open) {
          wrap.classList.add("is-open");
          panel.hidden = false;
          menuBtn.setAttribute("aria-expanded", "true");
          requestAnimationFrame(() => positionLfMenu(wrap));
        }
        return;
      }

      const menuItem = e.target.closest(".lf-menu-item[data-lf-workflow]");
      if (menuItem) {
        e.preventDefault();
        e.stopPropagation();
        const id = menuItem.dataset.leadId;
        const action = menuItem.dataset.lfWorkflow || menuItem.dataset.action;
        closeAllMenus();
        void handleMenuWorkflowAction(id, action);
        return;
      }

      const saveBtn = e.target.closest("[data-lead-save]");
      if (saveBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = saveBtn.getAttribute("data-lead-save");
        if (!id) return;
        const nowSaved = !savedIds.has(normalizeLeadId(id));
        toggleSaved(id);
        syncSaveButtonUi(saveBtn, nowSaved);
        invalidateGridRender();
        updateViewUi();
        applyFilters();
        return;
      }
      const builderBtn = e.target.closest("[data-lead-builder]");
      if (builderBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (builderBtn.disabled || builderBtn.getAttribute("aria-disabled") === "true") {
          return;
        }
        const id = builderBtn.getAttribute("data-lead-builder");
        if (!id) return;
        void handleBuildLeadClick(id);
      }
    });
  }

  function bindMenuDismiss() {
    if (menuDocBound) return;
    menuDocBound = true;
    document.addEventListener("click", (e) => {
      if (e.target.closest(".lf-card-menu-wrap")) return;
      closeAllMenus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllMenus();
    });
    window.addEventListener(
      "resize",
      () => {
        document.querySelectorAll(".lf-card-menu-wrap.is-open").forEach(positionLfMenu);
      },
      { passive: true }
    );
    document.addEventListener(
      "scroll",
      () => {
        if (document.querySelector(".lf-card-menu-wrap.is-open")) closeAllMenus();
      },
      { passive: true, capture: true }
    );
  }

  let syncFilterTimer = null;
  /** False until leads + workflow sync have loaded once (avoids stat count flash). */
  let leadsPageReady = false;
  let completePollTimer = null;
  let completePollBound = false;

  function refreshTeamProfilePhotos() {
    const RPP = global.RepProfilePhoto;
    if (!RPP?.refreshTeamPhotos) return Promise.resolve();
    return RPP.refreshTeamPhotos().then(() => {
      const grid = $("lf-grid");
      if (grid && (listView === "complete" || listView === "not-interested")) {
        delete grid.dataset.renderSig;
        renderGrid();
      }
    });
  }

  function manageTeamStatusPoll() {
    clearInterval(completePollTimer);
    completePollTimer = null;
    const teamViews = ["complete", "not-interested"];
    if (!teamViews.includes(listView) || !window.LeadSync?.isConfigured?.()) return;
    completePollTimer = setInterval(() => {
      window.LeadSync?.refreshTeam?.().catch((e) => {
        console.warn("Team status refresh failed", e);
      });
    }, 8000);
    if (!completePollBound) {
      completePollBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (!teamViews.includes(listView)) return;
        window.LeadSync?.refreshTeam?.().catch(() => {});
      });
    }
    window.LeadSync?.refreshTeam?.().catch(() => {});
    refreshTeamProfilePhotos().catch(() => {});
  }
  let refreshBusy = false;

  function showLeadsLoadError(err) {
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
  }

  function setRefreshBusy(busy) {
    refreshBusy = busy;
    const btn = $("lf-refresh");
    if (!btn) return;
    btn.disabled = busy;
    btn.classList.toggle("is-loading", busy);
    if (busy) btn.setAttribute("aria-busy", "true");
    else btn.removeAttribute("aria-busy");
  }

  async function refreshLeads() {
    if (refreshBusy) return;
    setRefreshBusy(true);
    try {
      global.LeadsLoader?.clearCache?.();
      await retryTeamSync();
      await loadLeads();
    } catch (err) {
      showLeadsLoadError(err);
    } finally {
      setRefreshBusy(false);
      const btn = $("lf-refresh");
      if (btn && window.SiteIcons) window.SiteIcons.initIcons(btn);
    }
  }

  function scheduleFilterFromSync(map) {
    statusMap = map || statusMap;
    if (!leadsPageReady) return;
    clearTimeout(syncFilterTimer);
    const delay = listView === "complete" || listView === "not-interested" ? 60 : 150;
    syncFilterTimer = setTimeout(applyFilters, delay);
  }

  async function loadLeads() {
    const loader = window.LeadsLoader;
    if (!loader?.load) throw new Error("LeadsLoader missing");

    const cached = loader.peekCache?.();
    const showCachedFirst = !!(cached?.leads?.length);

    if (!showCachedFirst) {
      leadsPageReady = false;
      setMetricsLoading(true);
      const grid = $("lf-grid");
      if (grid) {
        grid.innerHTML =
          '<div class="leads-loading" role="status" aria-live="polite">' +
          '<span class="leads-loading-orb" aria-hidden="true"></span>' +
          '<span class="sr-only">Loading leads</span>' +
          "</div>";
      }
    } else {
      meta = cached.meta || {};
      allLeads = shuffleLeads(cached.leads);
      leadsPageReady = true;
      clearTimeout(syncFilterTimer);
      syncFilterTimer = null;
      lastViewFilterSig = "";
      applyFilters();
      setMetricsLoading(false);
    }

    const [data] = await Promise.all([
      loader.load(showCachedFirst && cached?.fresh ? { force: false } : {}),
      ensureSyncReady().catch((e) => {
        console.warn("Lead sync unavailable, using this device only", e);
        return null;
      }),
    ]);

    await consumeForceTeamRefresh();

    meta = data.meta || {};
    allLeads = shuffleLeads(data.leads || []);
    const websiteFilter = getWebsiteFilter();
    const availableCats = new Set(
      collectCategoryCounts(
        allLeads.filter((lead) => matchesWebsiteFilter(lead, websiteFilter))
      ).map(([cat]) => cat)
    );
    if (priorityCategories.size) {
      priorityCategories = new Set(
        Array.from(priorityCategories).filter((c) => availableCats.has(c))
      );
    }
    leadsPageReady = true;
    clearTimeout(syncFilterTimer);
    syncFilterTimer = null;
    lastViewFilterSig = "";
    applyFilters();
    refreshTeamProfilePhotos().catch(() => {});
    if ((location.hash || "").replace(/^#/, "").trim() === "pending") {
      global.DashboardPending?.openToggle?.(true);
    }
  }

  let pageReady = false;

  function init() {
    if (pageReady || document.body.dataset.page !== "leads") return;
    pageReady = true;
    bindMenuDismiss();
    bindGridMarkActions();
    reloadPersonalMarks();
    applyPrefsToUi();
    const hashViewInit = (location.hash || "").replace(/^#/, "").trim();
    if (WORKFLOW_VIEWS.some((w) => w.value === hashViewInit)) {
      listView = hashViewInit;
      syncWorkflowSelectFromListView();
    }

    $("lf-website-filter")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".lf-toggle-btn[data-filter]");
      if (!btn) return;
      document
        .querySelectorAll("#lf-website-filter .lf-toggle-btn[data-filter]")
        .forEach((b) => {
          const on = b === btn;
          b.classList.toggle("active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      applyFilters();
      savePrefs();
    });

    $("lf-reviews-filter")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".lf-toggle-btn[data-reviews-filter]");
      if (!btn) return;
      setReviewsFilterUi(btn.dataset.reviewsFilter);
      applyFilters();
      savePrefs();
    });

    $("lf-category-chips")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".leads-chip[data-category]");
      if (!chip) return;
      togglePriorityCategory(chip.dataset.category);
    });

    $("lf-workflow-view")?.addEventListener("change", (e) => {
      if (viewSelectSyncing) return;
      const v = e.target.value;
      if (WORKFLOW_VIEWS.some((w) => w.value === v)) {
        listView = v;
        applyFilters();
        savePrefs();
      } else {
        syncWorkflowSelectFromListView();
      }
    });

    const onSearchChange = (value) => {
      const changed = setSearchQuery(value);
      const clearBtn = $("lf-search-clear");
      if (clearBtn) clearBtn.hidden = !searchQuery;
      if (changed) applyFilters();
    };
    $("lf-search")?.addEventListener("input", (e) => onSearchChange(e.target.value));
    $("lf-search")?.addEventListener("search", (e) => onSearchChange(e.target.value));
    $("lf-search-clear")?.addEventListener("click", () => {
      const input = $("lf-search");
      if (input) {
        input.value = "";
        input.focus();
      }
      onSearchChange("");
    });

    $("lf-refresh")?.addEventListener("click", () => {
      refreshLeads();
    });

    window.addEventListener("rep-settings-ready", () => {
      if (document.body.dataset.page !== "leads") return;
      reloadPersonalMarks();
      applyPrefsToUi();
      if (allLeads.length) {
        applyFilters();
      }
    });

    window.addEventListener("leads-cache-refreshed", (e) => {
      if (document.body.dataset.page !== "leads") return;
      const payload = e.detail;
      if (!payload?.leads?.length) return;
      meta = payload.meta || {};
      allLeads = shuffleLeads(payload.leads);
      leadsPageReady = true;
      setMetricsLoading(false);
      applyFilters();
    });

    window.addEventListener("rep-session-changed", () => {
      if (document.body.dataset.page !== "leads") return;
      reloadPersonalMarks();
      window.LeadSync?.refreshTeam?.().catch(() => {});
      if (leadsPageReady) applyFilters();
    });

    // Restored from the back/forward (bfcache) after building + sending a lead:
    // the in-memory status map is stale, so re-pull the latest workflow status
    // (Pending / Building) and re-render so sent leads drop out of the list.
    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      if (document.body.dataset.page !== "leads") return;
      reloadPersonalMarks();
      const done = () => {
        if (leadsPageReady) applyFilters();
      };
      if (window.LeadSync?.refresh) {
        window.LeadSync.refresh().then(done).catch(done);
      } else {
        done();
      }
    });

    setMetricsLoading(true);
    loadLeads().catch((err) => {
      leadsPageReady = false;
      setMetricsLoading(false);
      ["lf-stat-total", "lf-stat-done"].forEach((id) => {
        const el = $(id);
        if (el) el.textContent = "-";
      });
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

  window.LeadsPage = {
    loadLeads,
    applyFilters,
    refreshLeads,
    getAvailableCount,
  };
})(window);
