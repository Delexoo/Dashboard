(function (global) {
  const PROGRESS_KEY = "lpc_sales_onboarding_progress_v1";

  function loadProgress() {
    try {
      const raw = global.RepStorage?.loadItem
        ? global.RepStorage.loadItem(PROGRESS_KEY)
        : localStorage.getItem(PROGRESS_KEY);
      return JSON.parse(raw || "{}");
    } catch (e) {
      return {};
    }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const root = document.getElementById("course-module-list");
    if (!root || !global.CourseModules) return;

    const progress = loadProgress();
    const modules = global.CourseModules.list();
    const done = global.CourseModules.completedCount(progress);
    const bar = document.getElementById("course-hub-bar");
    const label = document.getElementById("course-hub-label");

    if (bar) bar.style.width = modules.length ? (done / modules.length) * 100 + "%" : "0%";
    if (label) label.textContent = done + " of " + modules.length + " complete";

    const next = global.CourseModules.firstIncomplete(progress);

    root.innerHTML = modules
      .map((mod) => {
        const complete = global.CourseModules.isComplete(mod, progress);
        const isNext = next && next.id === mod.id;
        const link = global.CourseModules.href(mod);
        const badge = complete
          ? '<span class="course-mod-badge done">Done</span>'
          : isNext
            ? '<span class="course-mod-badge current">Up next</span>'
            : '<span class="course-mod-badge">' + esc(mod.duration) + "</span>";
        const typeHint =
          mod.type === "interactive"
            ? '<span class="course-mod-type">Interactive setup</span>'
            : '<span class="course-mod-type">Video or text</span>';

        return (
          `<a class="course-mod-card card${complete ? " is-done" : ""}${isNext ? " is-next" : ""}" href="${esc(link)}">` +
          `<span class="course-mod-num">${complete ? "✓" : mod.num}</span>` +
          `<div class="course-mod-body">` +
          `<div class="course-mod-title-row">` +
          `<h2 class="course-mod-title">${esc(mod.title)}</h2>` +
          badge +
          `</div>` +
          typeHint +
          `</div>` +
          `</a>`
        );
      })
      .join("");

    if (global.SiteIcons) global.SiteIcons.initIcons();
  }

  function init() {
    const run = () => render();
    if (global.SiteLock?.whenUnlocked) global.SiteLock.whenUnlocked(run);
    else run();
    global.addEventListener("onboarding-progress-changed", render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
