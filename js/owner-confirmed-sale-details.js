/**
 * Read-only "Owner confirmed sale" details (rep dashboard + Admin Console).
 */
(function (global) {
  const LEAD_SELECT =
    "id, rep_id, rep_name, business_name, price, phone, owner_name, preference, google_maps, created_at, sale_amount, commission_amount, lead_id";

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

  function detailRow(label, valueHtml) {
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

  function getClient() {
    return global.SiteSupabase?.getClient?.() || null;
  }

  function rowFromDeal(deal) {
    if (!deal || typeof deal !== "object") return null;
    return {
      business_name: deal.businessName || "",
      rep_name: deal.repName || global.RepSession?.getName?.() || "",
      price: deal.submittedPrice || "",
      phone: deal.submittedPhone || "",
      owner_name: deal.submittedOwnerName || "",
      preference: deal.submittedPreference || "",
      google_maps: deal.submittedGoogleMaps || "",
      created_at: deal.submittedAt || deal.createdAt || "",
      sale_amount: deal.saleAmount,
      commission_amount: deal.commission,
      lead_id: deal.leadId || "",
    };
  }

  async function fetchSubmissionForDeal(deal) {
    const client = getClient();
    if (!client || !deal) return null;

    const clientId = String(deal.newClientId || "").trim();
    const dealId = String(deal.id || "").trim();

    try {
      if (clientId) {
        const { data, error } = await client
          .from("new_clients")
          .select(LEAD_SELECT)
          .eq("id", clientId)
          .maybeSingle();
        if (!error && data) return data;
      }
      if (dealId) {
        const { data, error } = await client
          .from("new_clients")
          .select(LEAD_SELECT)
          .eq("tracker_deal_id", dealId)
          .maybeSingle();
        if (!error && data) return data;
      }
    } catch (e) {
      console.warn("Owner confirmed sale: could not load submission", e);
    }
    return null;
  }

  function buildDetailsHtml(deal, row, options) {
    const source = row || rowFromDeal(deal) || {};
    const business = esc(source.business_name || deal?.businessName || "—");
    const repName = esc(
      source.rep_name || deal?.repName || global.RepSession?.getName?.() || "—"
    );
    const price = esc(source.price || "—");
    const phone = esc(source.phone || "");
    const ownerName = esc(source.owner_name || "");
    const preference = esc(source.preference || "");
    const leadId = esc(source.lead_id || deal?.leadId || "");
    const submitted = esc(
      formatSubmittedWhen(source.created_at || deal?.submittedAt || deal?.createdAt)
    );
    const confirmedSale = Number(source.sale_amount ?? deal?.saleAmount) || 0;
    const confirmedComm = Number(source.commission_amount ?? deal?.commission) || 0;
    const commissionLabel = options?.commissionLabel || "Your commission";

    let mapsHtml = "";
    const mapsRaw = String(source.google_maps || deal?.submittedGoogleMaps || "").trim();
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

    return (
      detailRow("Business", "<strong>" + business + "</strong>") +
      detailRow("Rep", repName) +
      detailRow("Submitted tier", price) +
      detailRow("Phone", phone) +
      detailRow("Business owner", ownerName) +
      detailRow("Preference", preference) +
      detailRow("Google Maps", mapsHtml) +
      detailRow("Lead ID", leadId) +
      detailRow("Submitted", submitted) +
      (confirmedSale
        ? detailRow("Confirmed sale", "<strong>$" + formatMoney(confirmedSale) + "</strong>")
        : "") +
      (confirmedComm
        ? detailRow(commissionLabel, "<strong>$" + formatMoney(confirmedComm) + "</strong>")
        : "")
    );
  }

  function closeDialog() {
    const dialog = document.getElementById("owner-confirmed-sale-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function ensureDialog() {
    const dialog = document.getElementById("owner-confirmed-sale-dialog");
    if (dialog && dialog.parentElement !== document.body) {
      document.body.appendChild(dialog);
    }
    return dialog;
  }

  function resolveDeal(dealId) {
    const id = String(dealId || "").trim();
    if (!id) return null;
    const deal = global.LpcTracker?.getDealById?.(id);
    if (!deal) return null;
    if (global.LpcTracker?.isOwnerConfirmedDeal?.(deal)) return deal;
    if (deal.fromOwnerConfirm) return deal;
    return null;
  }

  function isOwnerCardActionClick(target) {
    return !!target?.closest?.(
      ".sale-card-actions, .sale-card-edit-form, [data-team-sale-edit], [data-team-sale-delete], [data-team-sale-cancel], [data-sale-edit], [data-sale-delete], [data-sale-cancel]"
    );
  }

  function bindOwnerConfirmedCards() {
    if (document.body.dataset.ownerConfirmedCardsBound === "1") return;
    document.body.dataset.ownerConfirmedCardsBound = "1";

    document.addEventListener("click", (e) => {
      if (isOwnerCardActionClick(e.target)) return;
      const card = e.target.closest(".sale-card--owner-locked[data-deal-id]");
      if (!card || card.closest(".owner-console-recent-sales")) return;
      e.preventDefault();
      const deal = resolveDeal(card.getAttribute("data-deal-id"));
      if (deal) open(deal);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (isOwnerCardActionClick(e.target)) return;
      const card = e.target.closest(".sale-card--owner-locked[data-deal-id]");
      if (!card || card.closest(".owner-console-recent-sales")) return;
      e.preventDefault();
      const deal = resolveDeal(card.getAttribute("data-deal-id"));
      if (deal) open(deal);
    });
  }

  async function open(deal, options) {
    const dialog = ensureDialog();
    const details = document.getElementById("owner-confirmed-sale-details");
    if (!dialog || !details || !deal) return;

    details.innerHTML =
      '<div class="owner-console-detail-row"><dt>Loading</dt><dd>Fetching lead details…</dd></div>';

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");

    const row = await fetchSubmissionForDeal(deal);
    details.innerHTML = buildDetailsHtml(deal, row, options);
  }

  function bindDialog() {
    ensureDialog();
    const dialog = document.getElementById("owner-confirmed-sale-dialog");
    const closeBtn = document.getElementById("owner-confirmed-sale-close");
    if (!dialog || dialog.dataset.bound === "1") return;
    dialog.dataset.bound = "1";

    closeBtn?.addEventListener("click", () => closeDialog());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) closeDialog();
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      closeDialog();
    });
  }

  function init() {
    bindDialog();
    bindOwnerConfirmedCards();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.addEventListener("site-app-ready", init);

  global.OwnerConfirmedSaleDetails = {
    open,
    close: closeDialog,
    buildDetailsHtml,
    fetchSubmissionForDeal,
  };
})(window);
