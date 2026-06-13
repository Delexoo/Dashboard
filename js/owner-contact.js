/**
 * Meet the Owner — platform icon links (phone, Telegram, Cal.com, store).
 */
(function (global) {
  function cfg() {
    return global.SITE_CONFIG || {};
  }

  function phoneE164(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return "+1" + digits;
    if (digits.length === 11 && digits[0] === "1") return "+" + digits;
    return "+" + digits;
  }

  function wirePhoneLink() {
    const e164 = phoneE164(cfg().phone);
    const link = document.getElementById("owner-phone-link");
    if (link && e164) link.href = "sms:" + e164;
  }

  function init() {
    if (document.body.dataset.page !== "owner") return;
    wirePhoneLink();
  }

  global.OwnerContact = { init };

  global.addEventListener("site-unlocked", init);
  document.addEventListener("DOMContentLoaded", () => {
    if (global.sessionStorage?.getItem("lpc_site_unlock") === "1") init();
  });
  if (document.body.dataset.appBooted === "1") init();
})(window);
