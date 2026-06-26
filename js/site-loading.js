(function (global) {
  const SHOW_DELAY_MS = 700;
  const MIN_VISIBLE_MS = 400;

  let widget = null;
  let showTimer = 0;
  let visibleAt = 0;
  let settled = false;

  function hasAppShell() {
    return !!document.getElementById("shell");
  }

  function isLockPending() {
    return (
      document.documentElement.classList.contains("site-lock-active") &&
      document.body?.dataset?.appBooted !== "1"
    );
  }

  function isPageReady() {
    if (document.readyState === "loading") return false;
    if (!hasAppShell()) return true;
    if (isLockPending()) return !!document.getElementById("site-lock");
    return document.body?.dataset?.appBooted === "1";
  }

  function createWidget() {
    if (widget || document.getElementById("site-loading-widget")) return;
    if (!document.body) return;
    widget = document.createElement("div");
    widget.id = "site-loading-widget";
    widget.className = "site-loading-widget";
    widget.setAttribute("role", "status");
    widget.setAttribute("aria-live", "polite");
    widget.innerHTML =
      '<span class="site-loading-spinner" aria-hidden="true"></span>' +
      '<span class="site-loading-label">Loading...</span>';
    document.body.appendChild(widget);
  }

  function showWidget() {
    if (settled) return;
    createWidget();
    if (!widget) return;
    requestAnimationFrame(() => {
      if (widget && !settled) widget.classList.add("is-visible");
    });
  }

  function removeWidget() {
    if (!widget) return;
    const el = widget;
    widget = null;
    const done = () => el.remove();
    el.addEventListener("transitionend", done, { once: true });
    global.setTimeout(done, 500);
  }

  function hideWidget() {
    if (!widget) return;
    widget.classList.remove("is-visible");
    widget.classList.add("is-hiding");
    removeWidget();
  }

  function settle() {
    if (settled) return;
    if (!isPageReady()) return;

    settled = true;
    global.clearTimeout(showTimer);

    if (!widget) return;

    const wasVisible = widget.classList.contains("is-visible");
    if (!wasVisible) {
      widget.remove();
      widget = null;
      return;
    }

    const elapsed = Date.now() - visibleAt;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    global.setTimeout(hideWidget, wait);
  }

  function scheduleShow() {
    showTimer = global.setTimeout(() => {
      if (settled || isPageReady()) return;
      visibleAt = Date.now();
      showWidget();
    }, SHOW_DELAY_MS);
  }

  function checkSettle() {
    if (isPageReady()) settle();
  }

  function init() {
    scheduleShow();
    global.addEventListener("load", checkSettle);
    global.addEventListener("site-app-ready", checkSettle);
    global.addEventListener("site-unlocked", () => global.setTimeout(checkSettle, 0));

    const poll = global.setInterval(() => {
      checkSettle();
      if (settled) global.clearInterval(poll);
    }, 100);
    global.setTimeout(() => global.clearInterval(poll), 30000);
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);

  const ACTION_SHOW_DELAY_MS = 700;
  let actionWidget = null;
  let actionShowTimer = 0;
  let actionBusyDepth = 0;

  function ensureActionWidget(label) {
    if (!actionWidget) {
      if (!document.body) return null;
      actionWidget = document.createElement("div");
      actionWidget.id = "site-action-loading-widget";
      actionWidget.className = "site-loading-widget site-action-loading-widget";
      actionWidget.setAttribute("role", "status");
      actionWidget.setAttribute("aria-live", "polite");
      actionWidget.innerHTML =
        '<span class="site-loading-spinner" aria-hidden="true"></span>' +
        '<span class="site-loading-label">Loading...</span>';
      document.body.appendChild(actionWidget);
    }
    const labelEl = actionWidget.querySelector(".site-loading-label");
    if (labelEl) labelEl.textContent = label || "Loading...";
    return actionWidget;
  }

  function showBusy(label, options) {
    options = options || {};
    actionBusyDepth += 1;
    const busyLabel = String(label || "Loading...").trim() || "Loading...";
    const delay = options.immediate === true ? 0 : ACTION_SHOW_DELAY_MS;
    global.clearTimeout(actionShowTimer);
    actionShowTimer = global.setTimeout(() => {
      if (actionBusyDepth <= 0) return;
      const el = ensureActionWidget(busyLabel);
      if (!el) return;
      requestAnimationFrame(() => {
        if (actionWidget && actionBusyDepth > 0) {
          actionWidget.classList.remove("is-hiding");
          actionWidget.classList.add("is-visible");
        }
      });
    }, delay);
  }

  function hideBusy() {
    actionBusyDepth = Math.max(0, actionBusyDepth - 1);
    if (actionBusyDepth > 0) return;
    global.clearTimeout(actionShowTimer);
    if (!actionWidget) return;
    actionWidget.classList.remove("is-visible");
    actionWidget.classList.add("is-hiding");
    const el = actionWidget;
    const done = () => {
      if (actionBusyDepth <= 0 && el.parentNode) {
        el.classList.remove("is-hiding");
      }
    };
    el.addEventListener("transitionend", done, { once: true });
    global.setTimeout(done, 500);
  }

  const TOAST_VISIBLE_MS = 2800;
  let toastWidget = null;
  let toastHideTimer = 0;

  function ensureToastWidget() {
    if (toastWidget || document.getElementById("site-toast-widget")) {
      toastWidget = toastWidget || document.getElementById("site-toast-widget");
      return toastWidget;
    }
    if (!document.body) return null;
    toastWidget = document.createElement("div");
    toastWidget.id = "site-toast-widget";
    toastWidget.className = "site-loading-widget site-toast-widget";
    toastWidget.setAttribute("role", "status");
    toastWidget.setAttribute("aria-live", "polite");
    toastWidget.innerHTML =
      '<span class="site-toast-icon" aria-hidden="true"></span>' +
      '<span class="site-loading-label site-toast-label"></span>';
    document.body.appendChild(toastWidget);
    return toastWidget;
  }

  function hideToast() {
    if (!toastWidget) return;
    global.clearTimeout(toastHideTimer);
    toastWidget.classList.remove("is-visible");
    toastWidget.classList.add("is-hiding");
    const el = toastWidget;
    const done = () => el.classList.remove("is-hiding");
    el.addEventListener("transitionend", done, { once: true });
    global.setTimeout(done, 500);
  }

  function showToast(message, options) {
    options = options || {};
    const msg = String(message || "").trim();
    if (!msg) return;

    global.clearTimeout(toastHideTimer);
    const el = ensureToastWidget();
    if (!el) return;

    const label = el.querySelector(".site-toast-label");
    const icon = el.querySelector(".site-toast-icon");
    if (label) label.textContent = msg;

    const kind = String(options.kind || "success").trim();
    el.classList.remove(
      "is-hiding",
      "site-toast-widget--success",
      "site-toast-widget--error",
      "site-toast-widget--info"
    );
    el.classList.add(
      kind === "error"
        ? "site-toast-widget--error"
        : kind === "info"
          ? "site-toast-widget--info"
          : "site-toast-widget--success"
    );

    if (icon) {
      if (options.spinner) {
        icon.innerHTML = '<span class="site-loading-spinner" aria-hidden="true"></span>';
      } else if (kind === "error") {
        icon.textContent = "!";
      } else {
        icon.textContent = "✓";
      }
    }

    requestAnimationFrame(() => {
      el.classList.remove("is-hiding");
      void el.offsetWidth;
      el.classList.add("is-visible");
    });

    const duration = Number(options.duration);
    toastHideTimer = global.setTimeout(
      hideToast,
      Number.isFinite(duration) && duration > 0 ? duration : TOAST_VISIBLE_MS
    );
  }

  global.SiteLoading = {
    settle: checkSettle,
    show: showWidget,
    hide: hideWidget,
    showBusy,
    hideBusy,
    showToast,
    hideToast,
  };
})(window);
