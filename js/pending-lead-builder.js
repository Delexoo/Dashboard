/**
 * Lead Builder details saved per pending lead (price, business name, etc.).
 */
(function (global) {
  const KEY = "lpc_pending_lead_builder_v1";

  function loadMap() {
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(KEY)
        : localStorage.getItem(KEY);
      const map = JSON.parse(raw || "{}");
      return map && typeof map === "object" ? map : {};
    } catch (e) {
      return {};
    }
  }

  function saveMap(map) {
    const json = JSON.stringify(map || {});
    if (global.RepStorage?.saveItem) global.RepStorage.saveItem(KEY, json);
    else localStorage.setItem(KEY, json);
  }

  function parsePrice(raw) {
    const n = parseFloat(String(raw || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function formatPriceLabel(amount, fallback) {
    const fb = String(fallback || "").trim();
    if (fb) return fb;
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "";
    return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function save(leadId, details) {
    const id = String(leadId || "").trim();
    if (!id || !details) return;
    const map = loadMap();
    const priceRaw = String(details.price || details.amount || "").trim();
    const amount = parsePrice(priceRaw);
    map[id] = {
      leadId: id,
      businessName: String(details.businessName || details.business_name || "").trim(),
      price: formatPriceLabel(amount, priceRaw),
      amount,
      phone: String(details.phone || "").trim(),
      ownerName: String(details.ownerName || details.owner_name || "").trim(),
      preference: String(details.preference || "").trim(),
      submittedAt: new Date().toISOString(),
    };
    saveMap(map);
  }

  function get(leadId) {
    const id = String(leadId || "").trim();
    if (!id) return null;
    return loadMap()[id] || null;
  }

  function clear(leadId) {
    const id = String(leadId || "").trim();
    if (!id) return;
    const map = loadMap();
    if (!map[id]) return;
    delete map[id];
    saveMap(map);
  }

  global.PendingLeadBuilder = {
    save,
    get,
    clear,
    parsePrice,
    formatPriceLabel,
  };
})(window);
