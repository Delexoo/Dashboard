/** Place #page-body inside #main-content before app.js runs (prevents blank top + scroll). */
(function () {
  function go() {
    if (document.body?.classList?.contains("legal-standalone-mode")) return;
    var shell = document.getElementById("shell");
    var slot = document.getElementById("page-body");
    if (!shell || !slot) return;
    var main = document.getElementById("main-content");
    if (!main) {
      main = document.createElement("main");
      main.className = "main";
      main.id = "main-content";
      shell.appendChild(main);
    }
    if (slot.parentElement !== main) main.appendChild(slot);
  }
  go();
})();
