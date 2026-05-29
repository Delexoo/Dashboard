/**
 * Rep payout method picker (accounts page) + team list (owner page).
 */
(function (global) {
  const LOCAL_KEY = "lpc_rep_payout_v1";

  const METHODS = [
    {
      id: "cashapp",
      label: "Cash App",
      short: "$",
      placeholder: "cash.app/$yourname",
      hint: "Paste your Cash App link or $cashtag URL",
      fieldLabel: "Paste your payout link",
    },
    {
      id: "venmo",
      label: "Venmo",
      short: "V",
      placeholder: "venmo.com/u/yourname",
      hint: "Paste your Venmo profile link",
      fieldLabel: "Paste your payout link",
    },
    {
      id: "paypal",
      label: "PayPal",
      short: "P",
      placeholder: "paypal.me/yourname",
      hint: "Paste your PayPal.me link",
      fieldLabel: "Paste your payout link",
    },
    {
      id: "zelle",
      label: "Zelle",
      short: "Z",
      placeholder: "you@email.com or (555) 123-4567",
      hint: "Paste the email or phone you use for Zelle",
      fieldLabel: "Zelle email or phone",
      plainText: true,
    },
    {
      id: "applepay",
      label: "Apple Pay",
      short: "A",
      placeholder: "(555) 123-4567 or Apple ID email",
      hint: "Paste the phone number or email linked to your Apple Pay",
      fieldLabel: "Apple Pay details",
      plainText: true,
    },
    {
      id: "googlepay",
      label: "Google Pay",
      short: "G",
      placeholder: "you@gmail.com or phone",
      hint: "Paste the email or phone you use for Google Pay",
      fieldLabel: "Google Pay details",
      plainText: true,
    },
    {
      id: "wise",
      label: "Wise",
      short: "W",
      placeholder: "wise.com/pay/me/yourname",
      hint: "Paste your Wise payment link",
      fieldLabel: "Paste your Wise link",
    },
    {
      id: "stripe",
      label: "Stripe",
      short: "S",
      placeholder: "buy.stripe.com/your-link",
      hint: "Paste your Stripe Payment Link (buy.stripe.com, pay.stripe.com, or invoice URL)",
      fieldLabel: "Paste your Stripe link",
    },
    {
      id: "crypto",
      label: "Crypto",
      short: "₿",
      placeholder: "Wallet address or payment link",
      hint: "Paste your crypto wallet address or payment link",
      fieldLabel: "Crypto payout link",
      plainText: true,
    },
    {
      id: "other",
      label: "Other",
      short: "…",
      placeholder: "Payment link or phone number",
      hint: "Paste a payment link to your account or a phone number you use to get paid",
      fieldLabel: "Payment link or phone",
      plainText: true,
    },
  ];

  let client = null;

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function canSync() {
    const { url, key } = cfg();
    return !!(url && key && global.supabase?.createClient);
  }

  function getClient() {
    if (client) return client;
    if (!canSync()) return null;
    const { url, key } = cfg();
    client = global.supabase.createClient(url, key);
    return client;
  }

  function rep() {
    return global.RepSession?.get?.() || null;
  }

  function localKey() {
    const id = rep()?.id;
    return id ? "lpc_rep_" + id + "_" + LOCAL_KEY : LOCAL_KEY;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocal(data) {
    localStorage.setItem(localKey(), JSON.stringify(data));
  }

  function isPlainTextMethod(method) {
    return !!METHODS.find((m) => m.id === method)?.plainText;
  }

  function normalizeLink(method, raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    if (isPlainTextMethod(method)) return t;
    if (/^https?:\/\//i.test(t)) return t;
    if (method === "cashapp") {
      if (t.startsWith("$")) return "https://cash.app/" + t.replace(/^\$/, "");
      if (t.includes("cash.app")) return "https://" + t.replace(/^https?:\/\//i, "");
      return "https://cash.app/" + t.replace(/^\/+/, "");
    }
    if (method === "venmo") {
      if (t.includes("venmo.com")) return "https://" + t.replace(/^https?:\/\//i, "");
      return "https://venmo.com/u/" + t.replace(/^@/, "").replace(/^\/+/, "");
    }
    if (method === "paypal") {
      if (t.includes("paypal.")) return "https://" + t.replace(/^https?:\/\//i, "");
      return "https://paypal.me/" + t.replace(/^\/+/, "");
    }
    if (method === "wise") {
      if (t.includes("wise.com")) return "https://" + t.replace(/^https?:\/\//i, "");
      return "https://wise.com/pay/me/" + t.replace(/^\/+/, "");
    }
    if (method === "stripe") {
      if (/stripe\.com/i.test(t)) {
        return /^https?:\/\//i.test(t) ? t : "https://" + t.replace(/^\/+/, "");
      }
      return t;
    }
    return t;
  }

  function methodLabel(id) {
    const hit = METHODS.find((m) => m.id === id);
    if (hit) return hit.label;
    if (!id) return "";
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function fetchMine() {
    const r = rep();
    if (!r) return loadLocal();

    const sb = getClient();
    if (!sb) return loadLocal();

    const { data, error } = await sb
      .from("rep_payouts")
      .select("method,payout_link,updated_at")
      .eq("rep_id", r.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return loadLocal();
    const out = {
      method: data.method,
      link: data.payout_link,
      updatedAt: data.updated_at,
    };
    saveLocal(out);
    return out;
  }

  async function saveMine(method, link) {
    const r = rep();
    const normalized = normalizeLink(method, link);
    if (!normalized) throw new Error("Enter your payout link");

    const payload = {
      method,
      link: normalized,
      updatedAt: new Date().toISOString(),
    };
    saveLocal(payload);

    if (!r) return payload;

    const sb = getClient();
    if (!sb) return payload;

    const { error } = await sb.from("rep_payouts").upsert(
      {
        rep_id: r.id,
        rep_name: r.name,
        method,
        payout_link: normalized,
        updated_at: payload.updatedAt,
      },
      { onConflict: "rep_id" }
    );
    if (error) throw error;
    return payload;
  }

  async function resetMine() {
    const r = rep();
    if (!r?.id) {
      throw new Error("Sign in with your PIN before resetting payout.");
    }

    try {
      localStorage.removeItem(localKey());
    } catch (e) {
      /* ignore */
    }

    const sb = getClient();
    if (!sb) {
      unmarkPayoutChecklist();
      return { cloud: false, reason: "no_client" };
    }

    const { error } = await sb.from("rep_payouts").delete().eq("rep_id", r.id);
    if (error) {
      const msg = String(error.message || "");
      if (/policy|permission|denied|42501/i.test(msg)) {
        throw new Error(
          "Could not delete from Supabase — run supabase-rep-payouts-setup.sql (delete policy) in the SQL Editor."
        );
      }
      throw error;
    }

    unmarkPayoutChecklist();
    return { cloud: true };
  }

  function unmarkPayoutChecklist() {
    try {
      const key = global.RepStorage?.key
        ? global.RepStorage.key("lpc_sales_onboarding_progress_v1")
        : "lpc_sales_onboarding_progress_v1";
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem("lpc_sales_onboarding_progress_v1")
        : localStorage.getItem(key);
      const p = JSON.parse(raw || "{}");
      delete p.payout;
      if (global.RepStorage?.saveItem) {
        global.RepStorage.saveItem("lpc_sales_onboarding_progress_v1", JSON.stringify(p));
      } else {
        localStorage.setItem(key, JSON.stringify(p));
      }
    } catch (e) {
      /* ignore */
    }
  }

  function markPayoutChecklistDone() {
    try {
      const key = global.RepStorage?.key
        ? global.RepStorage.key("lpc_sales_onboarding_progress_v1")
        : "lpc_sales_onboarding_progress_v1";
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem("lpc_sales_onboarding_progress_v1")
        : localStorage.getItem(key);
      const p = JSON.parse(raw || "{}");
      p.payout = true;
      if (global.RepStorage?.saveItem) {
        global.RepStorage.saveItem("lpc_sales_onboarding_progress_v1", JSON.stringify(p));
      } else {
        localStorage.setItem(key, JSON.stringify(p));
      }
    } catch (e) {
      /* ignore */
    }
  }

  function renderMethodButtons(selected) {
    return METHODS.map(
      (m) =>
        `<button type="button" class="payout-method-btn payout-method-${esc(m.id)}" data-method="${esc(m.id)}" aria-pressed="${selected === m.id ? "true" : "false"}">` +
        `<span class="payout-method-icon" aria-hidden="true">${esc(m.short || m.label.charAt(0))}</span>` +
        `<span class="payout-method-label">${esc(m.label)}</span>` +
        `</button>`
    ).join("");
  }

  function initRepForm(root) {
    if (!root || root.dataset.bound) return;
    root.dataset.bound = "1";

    let selectedMethod = null;
    let saved = null;

    const methodsEl = root.querySelector("#payout-methods");
    const panelEl = root.querySelector("#payout-input-panel");
    const inputEl = root.querySelector("#payout-link-input");
    const hintEl = root.querySelector("#payout-input-hint");
    const saveBtn = root.querySelector("#payout-save-btn");
    const resetBtn = root.querySelector("#payout-reset-btn");
    const fieldLabelEl = root.querySelector("#payout-field-label");
    const statusEl = root.querySelector("#payout-status");
    const savedEl = root.querySelector("#payout-saved-preview");

    function showStatus(msg, type) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.hidden = !msg;
      statusEl.className = "payout-status" + (type ? " payout-status-" + type : "");
    }

    function showSavedPreview(data) {
      if (!savedEl || !data?.link) {
        if (savedEl) savedEl.hidden = true;
        return;
      }
      const plain = isPlainTextMethod(data.method);
      savedEl.hidden = false;
      savedEl.innerHTML =
        `<p class="payout-saved-title">Saved for <strong>${esc(rep()?.name || "you")}</strong></p>` +
        `<p class="payout-saved-row"><span class="legal-pill">${esc(methodLabel(data.method))}</span> ` +
        (plain
          ? `<span class="payout-saved-text">${esc(data.link)}</span>`
          : `<a class="link-bold-blue" href="${esc(data.link)}" target="_blank" rel="noopener">${esc(data.link)}</a>`) +
        `</p>`;
    }

    function clearForm() {
      selectedMethod = null;
      saved = null;
      if (inputEl) inputEl.value = "";
      if (panelEl) panelEl.hidden = true;
      if (savedEl) savedEl.hidden = true;
      methodsEl?.querySelectorAll(".payout-method-btn").forEach((btn) => {
        btn.setAttribute("aria-pressed", "false");
      });
      showStatus("", "");
    }

    function openPanel(method) {
      selectedMethod = method;
      const meta = METHODS.find((m) => m.id === method);
      if (panelEl) panelEl.hidden = false;
      if (fieldLabelEl) {
        fieldLabelEl.textContent = meta?.fieldLabel || "Paste your payout link";
      }
      if (inputEl) {
        inputEl.placeholder = meta?.placeholder || "";
        inputEl.value =
          saved && saved.method === method ? saved.link : "";
        inputEl.focus();
      }
      if (hintEl) hintEl.textContent = meta?.hint || "";
      methodsEl?.querySelectorAll(".payout-method-btn").forEach((btn) => {
        btn.setAttribute("aria-pressed", btn.dataset.method === method ? "true" : "false");
      });
      showStatus("", "");
    }

    methodsEl?.querySelectorAll(".payout-method-btn").forEach((btn) => {
      btn.addEventListener("click", () => openPanel(btn.dataset.method));
    });

    resetBtn?.addEventListener("click", async () => {
      if (
        !saved?.link &&
        !inputEl?.value?.trim() &&
        !selectedMethod
      ) {
        clearForm();
        return;
      }
      if (
        !window.confirm(
          "Clear your saved payout method? You will need to set it again before getting paid."
        )
      ) {
        return;
      }
      resetBtn.disabled = true;
      showStatus("Resetting…", "");
      try {
        const result = await resetMine();
        clearForm();
        if (result?.cloud) {
          showStatus("Payout cleared on this device and removed from Supabase.", "ok");
        } else {
          showStatus(
            "Payout cleared on this device. Supabase is not connected — owner will not see a team link until you save again.",
            "warn"
          );
        }
      } catch (e) {
        console.warn(e);
        showStatus(e.message || "Could not reset. Try again.", "err");
      }
      resetBtn.disabled = false;
    });

    saveBtn?.addEventListener("click", async () => {
      if (!selectedMethod) {
        showStatus("Choose a payout method first.", "warn");
        return;
      }
      const link = inputEl?.value?.trim();
      if (!link) {
        const meta = METHODS.find((m) => m.id === selectedMethod);
        showStatus(meta?.hint || "Enter your payout details.", "warn");
        inputEl?.focus();
        return;
      }
      saveBtn.disabled = true;
      showStatus("Saving…", "");
      try {
        saved = await saveMine(selectedMethod, link);
        markPayoutChecklistDone();
        showStatus("Saved — your manager can see this when a deal closes.", "ok");
        showSavedPreview(saved);
      } catch (e) {
        console.warn(e);
        showStatus(e.message || "Could not save. Try again.", "err");
      }
      saveBtn.disabled = false;
    });

    inputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveBtn?.click();
      }
    });

    (async () => {
      try {
        saved = await fetchMine();
        if (saved?.method) {
          selectedMethod = saved.method;
          methodsEl?.querySelectorAll(".payout-method-btn").forEach((btn) => {
            btn.setAttribute("aria-pressed", btn.dataset.method === saved.method ? "true" : "false");
          });
          if (panelEl) panelEl.hidden = false;
          if (inputEl) inputEl.value = saved.link || "";
          const meta = METHODS.find((m) => m.id === saved.method);
          if (fieldLabelEl) {
            fieldLabelEl.textContent = meta?.fieldLabel || "Paste your payout link";
          }
          if (hintEl) hintEl.textContent = meta?.hint || "";
          showSavedPreview(saved);
          showStatus("You can update your link anytime.", "ok");
        }
      } catch (e) {
        console.warn("Payout load failed", e);
      }
    })();
  }

  function init() {
    const run = () => {
      const form = document.getElementById("payout-setup");
      if (form) {
        const methods = form.querySelector("#payout-methods");
        if (methods && !methods.innerHTML.trim()) {
          methods.innerHTML = renderMethodButtons(null);
        }
        if (global.RepStorage?.whenReady) {
          global.RepStorage.whenReady(() => initRepForm(form));
        } else {
          initRepForm(form);
        }
      }
    };
    if (global.SiteLock?.whenUnlocked) global.SiteLock.whenUnlocked(run);
    else run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.PayoutSetup = {
    METHODS,
    fetchMine,
    saveMine,
    resetMine,
    methodLabel,
    isPlainTextMethod,
  };
})(window);
