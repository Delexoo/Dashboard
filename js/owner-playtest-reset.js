/**
 * Admin Console · advanced playtest data reset (PIN verified server-side).
 */
(function (global) {
  const DATASETS = [
    {
      id: "everything",
      label: "Full playtest reset",
      desc: "All categories below — sales, settings, leads, feedback, and more.",
      preset: true,
    },
    {
      id: "sales_tracker",
      label: "Sales tracker & hours",
      desc: "Logged sales, goals, commission tracker, online hours.",
    },
    {
      id: "course_progress",
      label: "Course & checklist",
      desc: "Onboarding progress and completed steps.",
    },
    {
      id: "scripts_templates",
      label: "Scripts & templates",
      desc: "Call scripts, outreach edits, Lead Builder drafts.",
    },
    {
      id: "ui_preferences",
      label: "UI & survey progress",
      desc: "Theme, sidebar, setup survey, workspace preferences.",
    },
    {
      id: "lead_finder_state",
      label: "Lead Finder state",
      desc: "Saved leads, workflow, pending builder (not the business list).",
    },
    {
      id: "profile_photos",
      label: "Profile photos",
      desc: "Uploaded avatars and stored photo URLs.",
    },
    {
      id: "payout_methods",
      label: "Payout methods",
      desc: "Cash App, Venmo, PayPal, and Zelle links.",
    },
    {
      id: "submitted_leads",
      label: "Submitted leads",
      desc: "Lead Builder sends in the Admin Console inbox.",
    },
    {
      id: "team_lead_workflow",
      label: "Team lead workflow",
      desc: "Pending, complete, and not-interested on Lead Finder.",
    },
    { id: "feedback_posts", label: "Feedback", desc: "Feedback form submissions." },
    {
      id: "bug_reports",
      label: "Bug reports",
      desc: "Bug bounty submissions (team-wide attachments when resetting all).",
    },
    { id: "faq_posts", label: "FAQ posts", desc: "Ask the team questions and replies." },
    {
      id: "display_names",
      label: "Display names",
      desc: "Reset nicknames to original account names · PINs are kept.",
    },
  ];

  let busy = false;
  let pendingAction = "reset";

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

  function cfg() {
    const c = global.SITE_CONFIG || {};
    return {
      url: String(c.supabaseUrl || "").trim(),
      key: String(c.supabaseAnonKey || "").trim(),
    };
  }

  function getClient() {
    return global.SiteSupabase?.getClient?.() || null;
  }

  function callerRepId() {
    return String(global.RepSession?.getId?.() || global.RepSession?.get?.()?.id || "").trim();
  }

  function setStatus(msg, isError) {
    const el = $("owner-playtest-status");
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      el.classList.remove("is-error", "is-success");
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.classList.toggle("is-error", !!isError);
    el.classList.toggle("is-success", !isError);
  }

  function datasetById(id) {
    return DATASETS.find((d) => d.id === id);
  }

  function renderDatasetOptions() {
    const wrap = $("owner-playtest-datasets");
    if (!wrap) return;
    wrap.innerHTML = DATASETS.map((ds) => {
      const isEverything = ds.id === "everything";
      return (
        '<label class="owner-playtest-dataset' +
        (isEverything ? " owner-playtest-dataset--everything" : "") +
        '">' +
        '<input type="checkbox" class="owner-playtest-dataset-input" value="' +
        esc(ds.id) +
        '"' +
        (isEverything ? " checked" : "") +
        (isEverything ? ' data-preset="1"' : "") +
        " />" +
        '<span class="owner-playtest-dataset-copy">' +
        "<strong>" +
        esc(ds.label) +
        "</strong>" +
        "<span>" +
        esc(ds.desc) +
        "</span>" +
        "</span>" +
        "</label>"
      );
    }).join("");
  }

  function syncSegmentActive(groupName) {
    document.querySelectorAll('input[name="' + groupName + '"]').forEach((input) => {
      const label = input.closest(".owner-playtest-segment-opt");
      if (label) label.classList.toggle("is-active", input.checked);
    });
  }

  function syncScopeUi() {
    const scope = document.querySelector('input[name="owner-playtest-scope"]:checked')?.value || "all_reps";
    const select = $("owner-playtest-rep");
    const repField = document.querySelector(".owner-playtest-rep-field");
    if (select) {
      select.disabled = scope !== "one_rep";
      select.toggleAttribute("aria-disabled", scope !== "one_rep");
    }
    if (repField) repField.classList.toggle("is-disabled", scope !== "one_rep");
    const custom = $("owner-playtest-custom-wrap");
    const presetOnly = $("owner-playtest-preset-only");
    const isCustom = !!$("owner-playtest-mode-custom")?.checked;
    if (custom) custom.hidden = !isCustom;
    if (presetOnly) presetOnly.hidden = isCustom;
    syncSegmentActive("owner-playtest-scope");
    syncSegmentActive("owner-playtest-mode");
  }

  function syncDatasetMode() {
    const isCustom = !!$("owner-playtest-mode-custom")?.checked;
    const inputs = document.querySelectorAll(".owner-playtest-dataset-input");
    inputs.forEach((input) => {
      if (input.dataset.preset === "1") {
        input.disabled = isCustom;
        if (isCustom) input.checked = false;
        return;
      }
      input.disabled = !isCustom;
      if (!isCustom) input.checked = false;
    });
    syncScopeUi();
  }

  function parseUsersTxtLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || trimmed.startsWith("#")) return null;
    const parts = trimmed.split(",").map((s) => s.trim());
    if (parts.length < 2) return null;
    const id = parts[0];
    const name = parts[1];
    if (!id) return null;
    return { id, name: name || id };
  }

  async function loadRepOptions() {
    const select = $("owner-playtest-rep");
    if (!select) return;

    const map = new Map();
    const add = (id, name) => {
      const key = String(id || "").trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { id: String(id).trim(), name: String(name || id).trim() || key });
      }
    };

    (global.SITE_CONFIG?.ownerRepIds || []).forEach((id) => add(id, id));

    try {
      const res = await fetch("users.txt", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        text.split(/\r?\n/).forEach((line) => {
          const row = parseUsersTxtLine(line);
          if (row) add(row.id, row.name);
        });
      }
    } catch (e) {
      /* optional file */
    }

    const sb = getClient();
    if (sb) {
      try {
        const { data } = await sb.from("rep_settings").select("rep_id, rep_name").order("rep_id");
        (data || []).forEach((row) => add(row.rep_id, row.rep_name));
      } catch (e) {
        console.warn("Playtest reset: could not load reps", e);
      }
    }

    const reps = [...map.values()].sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { sensitivity: "base" })
    );

    select.innerHTML =
      '<option value="">Choose a rep…</option>' +
      reps.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.id) + "</option>").join("");
  }

  function selectedDatasets() {
    const isCustom = !!$("owner-playtest-mode-custom")?.checked;
    if (!isCustom) return ["everything"];
    const ids = [...document.querySelectorAll(".owner-playtest-dataset-input:checked")].map(
      (el) => String(el.value || "").trim()
    );
    return ids.filter(Boolean);
  }

  function actionCopy(action) {
    if (action === "seed") {
      return {
        title: "Confirm playtest data",
        categories: "Add sample tracker deals, submitted leads, team workflow, payout method, feedback, bug, and FAQ data.",
        note: "Existing playtest rows are replaced. PIN accounts and the Lead Finder business list are never changed.",
        status: "Adding playtest data…",
        success: "Playtest data added.",
        submit: "Add data",
        danger: false,
      };
    }
    return {
      title: "Confirm playtest reset",
      categories: null,
      note: "PIN accounts and the Lead Finder business list are never deleted.",
      status: "Resetting playtest data…",
      success: "Playtest data reset complete.",
      submit: "Reset data",
      danger: true,
    };
  }

  function buildSummary(action) {
    const scope = document.querySelector('input[name="owner-playtest-scope"]:checked')?.value || "all_reps";
    const target = String($("owner-playtest-rep")?.value || "").trim();
    const datasets = selectedDatasets();
    const scopeLabel =
      scope === "one_rep"
        ? target
          ? "Rep · " + ($("owner-playtest-rep")?.selectedOptions?.[0]?.textContent || target)
          : "One rep (not chosen)"
        : "All reps";
    const datasetLabels = datasets
      .map((id) => datasetById(id)?.label || id)
      .filter(Boolean);
    return { scope, target, datasets, scopeLabel, datasetLabels, action };
  }

  function openDialog(action) {
    const dialog = $("owner-playtest-dialog");
    const title = $("owner-playtest-dialog-title");
    const summary = $("owner-playtest-summary");
    const pinInput = $("owner-playtest-pin");
    const submit = $("owner-playtest-submit");
    const err = $("owner-playtest-error");
    if (!dialog || !summary) return;

    pendingAction = action === "seed" ? "seed" : "reset";
    const copy = actionCopy(pendingAction);
    const info = buildSummary(pendingAction);
    if (info.scope === "one_rep" && !info.target) {
      setStatus("Choose a rep for this playtest action.", true);
      return;
    }
    if (pendingAction === "reset" && !info.datasets.length) {
      setStatus("Select at least one data category to reset.", true);
      return;
    }

    if (title) title.textContent = copy.title;
    if (submit) {
      submit.textContent = copy.submit;
      submit.classList.toggle("owner-console-dialog-btn--danger", copy.danger);
    }

    summary.innerHTML =
      '<div class="owner-console-detail-row">' +
      "<dt>Scope</dt>" +
      "<dd>" +
      esc(info.scopeLabel) +
      "</dd>" +
      "</div>" +
      '<div class="owner-console-detail-row">' +
      "<dt>Categories</dt>" +
      "<dd>" +
      esc(copy.categories || info.datasetLabels.join(" · ")) +
      "</dd>" +
      "</div>" +
      '<p class="owner-console-dialog-credit owner-playtest-summary-note">' +
      esc(copy.note) +
      "</p>";

    if (pinInput) {
      pinInput.value = "";
    }
    if (err) {
      err.hidden = true;
      err.textContent = "";
    }

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    pinInput?.focus();
  }

  function closeDialog() {
    const dialog = $("owner-playtest-dialog");
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function errorMessage(code) {
    switch (code) {
      case "invalid_pin":
        return "Incorrect PIN. Reset was not performed.";
      case "not_authorized":
        return "Only site owners can run a playtest reset.";
      case "not_configured":
        return "Reset PIN is not configured in Supabase yet.";
      case "target_required":
        return "Choose a rep for a single-rep reset.";
      case "datasets_required":
        return "Select at least one data category.";
      case "invalid_scope":
        return "Invalid reset scope.";
      default:
        return "Could not reset playtest data. Try again.";
    }
  }

  async function submitPlaytestAction() {
    if (busy) return;
    const sb = getClient();
    const submitBtn = $("owner-playtest-submit");
    const pinInput = $("owner-playtest-pin");
    const err = $("owner-playtest-error");
    const caller = callerRepId();

    if (!sb) {
      setStatus("Supabase is not configured.", true);
      return;
    }
    if (!caller) {
      setStatus("Sign in again to run a playtest reset.", true);
      return;
    }
    if (!global.SiteOwner?.isSiteOwner?.()) {
      setStatus("Only site owners can run a playtest reset.", true);
      return;
    }

    const info = buildSummary(pendingAction);
    const pin = String(pinInput?.value || "").trim();
    if (!pin) {
      if (err) {
        err.hidden = false;
        err.textContent = "Enter the reset PIN.";
      }
      pinInput?.focus();
      return;
    }

    busy = true;
    if (submitBtn) submitBtn.disabled = true;
    const copy = actionCopy(pendingAction);
    setStatus(copy.status);

    try {
      const args = {
        p_caller_rep_id: caller,
        p_pin: pin,
        p_scope: info.scope,
        p_target_rep_id: info.scope === "one_rep" ? info.target : null,
      };
      const rpcName = pendingAction === "seed" ? "seed_playtest_data" : "reset_playtest_data";
      const { data, error } =
        pendingAction === "seed"
          ? await sb.rpc(rpcName, args)
          : await sb.rpc(rpcName, { ...args, p_datasets: info.datasets });

      if (error) throw error;

      const result = data && typeof data === "object" ? data : {};
      if (!result.ok) {
        const msg = errorMessage(String(result.error || ""));
        if (err) {
          err.hidden = false;
          err.textContent = msg;
        }
        setStatus(msg, true);
        return;
      }

      closeDialog();
      setStatus(copy.success, false);

      if (global.OwnerSalesConsole?.refresh) {
        await global.OwnerSalesConsole.refresh();
      }
      if (global.OwnerConsoleTeamOverview?.refresh) {
        await global.OwnerConsoleTeamOverview.refresh();
      }
    } catch (e) {
      console.warn(e);
      const msg = e?.message || "Could not reset playtest data.";
      if (err) {
        err.hidden = false;
        err.textContent = msg;
      }
      setStatus(msg, true);
    } finally {
      busy = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function bindEvents() {
    $("owner-playtest-open")?.addEventListener("click", () => openDialog("reset"));
    $("owner-playtest-seed-open")?.addEventListener("click", () => openDialog("seed"));
    $("owner-playtest-cancel")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeDialog();
    });
    $("owner-playtest-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      void submitPlaytestAction();
    });
    $("owner-playtest-dialog")?.addEventListener("click", (e) => {
      if (e.target === $("owner-playtest-dialog")) closeDialog();
    });

    document.querySelectorAll('input[name="owner-playtest-scope"]').forEach((input) => {
      input.addEventListener("change", syncScopeUi);
    });
    document.querySelectorAll('input[name="owner-playtest-mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        syncDatasetMode();
      });
    });
    $("owner-playtest-mode-preset")?.addEventListener("change", syncDatasetMode);
    $("owner-playtest-mode-custom")?.addEventListener("change", syncDatasetMode);

    document.addEventListener("change", (e) => {
      const input = e.target.closest?.(".owner-playtest-dataset-input");
      if (!input || input.dataset.preset !== "1") return;
      if (input.checked) syncDatasetMode();
    });
  }

  function init() {
    if (document.body.dataset.page !== "sales-console") return;
    if (!global.SiteOwner?.isSiteOwner?.()) return;

    renderDatasetOptions();
    void loadRepOptions();
    syncDatasetMode();
    bindEvents();
  }

  function boot() {
    if (global.SiteLock?.whenUnlocked) global.SiteLock.whenUnlocked(init);
    else init();
  }

  document.addEventListener("DOMContentLoaded", boot);
  global.addEventListener("site-app-ready", boot, { once: true });
  if (document.readyState !== "loading") boot();
})(window);
