/**
 * Apply saved tracker stats before app.js runs (avoids flashing $2,000 defaults).
 */
(function () {
  const TRACKER_KEY = "lpc_sales_tracker_v2";
  const SESSION_KEY = "lpc_rep_session_v1";
  const DEFAULT_GOAL = 2000;

  function currentRepId() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      return s?.id ? String(s.id) : null;
    } catch (e) {
      return null;
    }
  }

  function storageKey() {
    const id = currentRepId();
    return id ? "lpc_rep_" + id + "_" + TRACKER_KEY : TRACKER_KEY;
  }

  function formatMoney(n) {
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return { goal: DEFAULT_GOAL, earned: 0, closes: 0 };
      const data = JSON.parse(raw);
      const deals = Array.isArray(data.deals) ? data.deals : [];
      const earned = deals.reduce((sum, d) => sum + (Number(d.commission) || 0), 0);
      let goal = Number(data.goal);
      if (!goal || goal <= 0) goal = DEFAULT_GOAL;
      return { goal, earned, closes: deals.length };
    } catch (e) {
      return { goal: DEFAULT_GOAL, earned: 0, closes: 0 };
    }
  }

  function apply() {
    const root = document.getElementById("sales-tracker");
    if (!root) return;

    const snap = loadSnapshot();
    const { goal, earned, closes } = snap;
    const pct = Math.min(100, (earned / goal) * 100);
    const pctRound = Math.round(pct);

    const goalDisplay = document.getElementById("goal-display-value");
    if (goalDisplay) goalDisplay.textContent = formatMoney(goal);

    const input = document.getElementById("tracker-goal");
    if (input) input.placeholder = String(goal);

    const earnedEl = document.getElementById("tracker-earned");
    if (earnedEl) earnedEl.textContent = "$" + formatMoney(earned);

    const closesEl = document.getElementById("tracker-closes");
    if (closesEl) closesEl.textContent = String(closes);

    const bar = document.getElementById("goal-bar");
    if (bar) bar.style.width = pct + "%";

    const pctBadge = document.getElementById("goal-pct-badge");
    if (pctBadge) pctBadge.textContent = pctRound + "%";

    const gl = document.getElementById("goal-pct-label");
    if (gl) gl.textContent = "$" + formatMoney(earned) + " of $" + formatMoney(goal);

    const rem = document.getElementById("tracker-remaining");
    if (rem) {
      rem.textContent =
        earned >= goal ? "Goal reached" : "$" + formatMoney(goal - earned) + " to go";
    }

    root.classList.add("dash-hydrated");
  }

  apply();
})();
