/**
 * Admin Console — team-wide activity, commission, and sales overview.
 */
(function (global) {
  const REFRESH_MS = 45000;

  let refreshTimer = null;
  let realtimeChannel = null;

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

  function getClient() {
    return global.SiteSupabase?.getClient?.() || null;
  }

  function pinnedRank(member) {
    const pinned = global.SITE_CONFIG?.contributorsPinnedFirst;
    if (!Array.isArray(pinned) || !member?.id) return 999;
    const key = String(member.id).toLowerCase();
    const idx = pinned.findIndex((id) => String(id).toLowerCase() === key);
    return idx === -1 ? 999 : idx;
  }

  function sortMembers(members) {
    return members.slice().sort((a, b) => {
      const rankDiff = pinnedRank(a) - pinnedRank(b);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  function renderTotals(totals, OTS) {
    const grid = $("owner-team-totals-grid");
    if (!grid || !OTS) return;

    const onlineLabel =
      totals.onlineCount > 0 ? totals.onlineCount + " online now" : "None online";

    const rows = [
      {
        label: "Total generated",
        value: "$" + OTS.formatMoney(totals.generated),
        highlight: true,
      },
      {
        label: "Profit",
        value: "$" + OTS.formatMoney(totals.profit),
        sub: "After 40% rep commission",
      },
      { label: "Team sales", value: OTS.saleCountLabel(totals.sales) },
      { label: "Hours on platform", value: OTS.formatLifetimeHours(totals.activeMs) },
      {
        label: "Contributors",
        value: String(totals.contributors),
        sub: onlineLabel,
      },
    ];

    grid.innerHTML = rows
      .map(
        (row) =>
          '<div class="owner-console-team-total' +
          (row.highlight ? " owner-console-team-total--highlight" : "") +
          '">' +
          "<dt>" +
          esc(row.label) +
          "</dt>" +
          "<dd>" +
          esc(row.value) +
          (row.sub
            ? '<span class="owner-console-team-total-sub">' + esc(row.sub) + "</span>"
            : "") +
          "</dd>" +
          "</div>"
      )
      .join("");
  }

  function selectedRepKey() {
    return String(global.OwnerSalesConsole?.getSelectedRepId?.() || "")
      .trim()
      .toLowerCase();
  }

  function renderMembers(members, OTS) {
    const body = $("owner-team-members-body");
    const tableWrap = document.querySelector(".owner-console-team-table-wrap");
    const empty = $("owner-team-overview-empty");
    if (!body) return;

    if (!members.length) {
      body.innerHTML = "";
      if (tableWrap) tableWrap.hidden = true;
      empty?.removeAttribute("hidden");
      return;
    }

    empty?.setAttribute("hidden", "");
    if (tableWrap) tableWrap.hidden = false;

    const activeKey = selectedRepKey();

    body.innerHTML = sortMembers(members)
      .map((member) => {
        const pct = Math.min(
          100,
          Math.round((member.earned / Math.max(1, member.goal)) * 100)
        );
        const activity = member.online
          ? "Online now"
          : member.activityLabel || "No activity yet";
        const memberKey = String(member.id || "").toLowerCase();
        const isSelected = !!activeKey && memberKey === activeKey;

        return (
          '<tr class="owner-console-team-row' +
          (isSelected ? " is-selected" : "") +
          '" data-overview-rep="' +
          esc(member.id) +
          '" tabindex="0" role="button" aria-pressed="' +
          (isSelected ? "true" : "false") +
          '" aria-label="View ' +
          esc(member.name) +
          ' dashboard">' +
          '<th scope="row" class="owner-console-team-rep">' +
          '<span class="owner-console-team-rep-label">' +
          esc(member.name) +
          "</span>" +
          "</th>" +
          '<td class="owner-console-team-activity' +
          (member.online ? " is-online" : "") +
          '">' +
          esc(activity) +
          "</td>" +
          "<td>" +
          esc(OTS.formatLifetimeHours(member.activeMs)) +
          "</td>" +
          '<td class="owner-console-team-money">$' +
          esc(OTS.formatMoney(member.earned)) +
          "</td>" +
          "<td>" +
          esc(OTS.saleCountLabel(member.sales)) +
          "</td>" +
          '<td class="owner-console-team-goal">' +
          esc(String(pct) + "%") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function highlightRep(repId) {
    const body = $("owner-team-members-body");
    if (!body) return;

    const activeKey = String(repId || "").trim().toLowerCase();
    body.querySelectorAll("tr[data-overview-rep]").forEach((row) => {
      const rowKey = String(row.getAttribute("data-overview-rep") || "").toLowerCase();
      const isSelected = !!activeKey && rowKey === activeKey;
      row.classList.toggle("is-selected", isSelected);
      row.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }

  function openRepDashboard(repId) {
    if (!repId) return;
    global.OwnerSalesConsole?.toggleRep?.(repId);
    $("owner-team-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("owner-console-team-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function refreshOverview() {
    const OTS = global.OwnerTeamStats;
    if (!OTS) return;

    const sb = getClient();
    await OTS.refresh(sb);
    const members = OTS.getMembers();
    const totals = OTS.getTotals();

    renderTotals(totals, OTS);
    renderMembers(members, OTS);
  }

  function bindOverviewTable() {
    const body = $("owner-team-members-body");
    if (!body || body.dataset.bound === "1") return;
    body.dataset.bound = "1";

    body.addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-overview-rep]");
      if (!row) return;
      openRepDashboard(row.getAttribute("data-overview-rep") || "");
    });

    body.addEventListener("keydown", (e) => {
      const row = e.target.closest("tr[data-overview-rep]");
      if (!row || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      openRepDashboard(row.getAttribute("data-overview-rep") || "");
    });
  }

  function subscribeRealtime() {
    const sb = getClient();
    if (!sb || realtimeChannel) return;

    realtimeChannel = sb
      .channel("owner-console-team-overview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rep_settings" },
        () => {
          void refreshOverview();
        }
      )
      .subscribe();
  }

  function init() {
    if (document.body.dataset.page !== "sales-console") return;

    bindOverviewTable();
    void refreshOverview();
    subscribeRealtime();

    refreshTimer = global.setInterval(() => {
      void refreshOverview();
    }, REFRESH_MS);

    global.addEventListener("rep-settings-synced", () => {
      void refreshOverview();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  global.OwnerConsoleTeamOverview = {
    refresh: refreshOverview,
    highlightRep,
  };
})(window);
