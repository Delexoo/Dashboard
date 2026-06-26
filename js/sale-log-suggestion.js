/**
 * After marking a lead complete, suggest logging the sale on the dashboard.
 */
(function (global) {
  const KEY = "lpc_sale_log_suggestion_v1";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function load() {
    try {
      const raw = global.RepStorage?.loadItem?.(KEY) || global.sessionStorage?.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const name = String(data?.businessName || "").trim();
      if (!name) return null;
      return {
        businessName: name,
        leadId: String(data?.leadId || "").trim(),
        at: Number(data?.at) || Date.now(),
      };
    } catch (e) {
      return null;
    }
  }

  function save(data) {
    const json = JSON.stringify(data);
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(KEY, json);
    else global.sessionStorage?.setItem(KEY, json);
    global.dispatchEvent(new Event("sale-log-suggestion-changed"));
  }

  function queue(businessName, leadId) {
    const name = String(businessName || "").trim();
    if (!name) return;
    save({
      businessName: name,
      leadId: String(leadId || "").trim(),
      at: Date.now(),
    });
    render();
  }

  function clear() {
    if (global.RepStorage?.removeItem) global.RepStorage.removeItem(KEY);
    else global.sessionStorage?.removeItem(KEY);
    global.dispatchEvent(new Event("sale-log-suggestion-changed"));
    render();
  }

  function render() {
    const slot = document.getElementById("dash-sale-suggestion");
    if (!slot || document.body.dataset.page !== "home") return;

    const sug = load();
    if (!sug) {
      slot.hidden = true;
      slot.innerHTML = "";
      return;
    }

    slot.hidden = false;
    slot.innerHTML =
      '<div class="dash-sale-suggestion-inner">' +
      '<div class="dash-sale-suggestion-copy">' +
      '<p class="dash-sale-suggestion-eyebrow">Ready to log</p>' +
      '<p class="dash-sale-suggestion-title">You completed <strong>' +
      esc(sug.businessName) +
      "</strong></p>" +
      '<p class="dash-sale-suggestion-desc">Add this close to your dashboard revenue tracker.</p>' +
      "</div>" +
      '<div class="dash-sale-suggestion-actions">' +
      '<button type="button" class="btn" data-dash-log-suggested-sale>Log sale</button>' +
      '<button type="button" class="btn secondary" data-dash-dismiss-suggested-sale>Dismiss</button>' +
      "</div>" +
      "</div>";

    slot.querySelector("[data-dash-log-suggested-sale]")?.addEventListener("click", () => {
      if (typeof global.openSalesIncomeDialog === "function") {
        global.openSalesIncomeDialog({ businessName: sug.businessName, focusAmount: true });
      } else {
        const businessEl = document.getElementById("businessName");
        if (businessEl) businessEl.value = sug.businessName;
        document.getElementById("saleAmount")?.focus();
      }
    });

    slot.querySelector("[data-dash-dismiss-suggested-sale]")?.addEventListener("click", clear);
  }

  function init() {
    if (document.body.dataset.page !== "home") return;
    render();
    global.addEventListener("sale-log-suggestion-changed", render);
    global.addEventListener("rep-session-changed", render);
  }

  global.SaleLogSuggestion = { queue, clear, get: load, render, init };
})(window);
