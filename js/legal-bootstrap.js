/**
 * Privacy / Terms · always standalone (no sidebar, no app shell).
 */
(function () {
  function loadScript(src, cb) {
    const s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      if (cb) cb();
    };
    s.onerror = function () {
      if (cb) cb();
    };
    document.body.appendChild(s);
  }

  function init() {
    document.body.classList.add("legal-standalone-mode");
    document.body.dataset.public = "1";

    loadScript("js/theme.js", function () {
      loadScript("js/legal-page.js");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
