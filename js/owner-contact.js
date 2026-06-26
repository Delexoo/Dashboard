/**
 * Meet the Owner · gallery, phone link, and contact wiring.
 */
(function (global) {
  function cfg() {
    return global.SITE_CONFIG || {};
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function renderGallery() {
    const root = document.getElementById("owner-gallery");
    const wrap = root?.closest(".owner-about-gallery-wrap");
    if (!root) return;

    const photos = Array.isArray(cfg().ownerGalleryPhotos) ? cfg().ownerGalleryPhotos : [];
    if (!photos.length) {
      if (wrap) wrap.hidden = true;
      return;
    }

    root.innerHTML = photos
      .map((photo, index) => {
        const src = typeof photo === "string" ? photo : photo?.src;
        if (!src) return "";
        const alt =
          typeof photo === "string"
            ? "Gallery photo " + (index + 1)
            : photo.alt || "Gallery photo " + (index + 1);
        return (
          '<figure class="owner-about-gallery-item">' +
          '<img src="' +
          esc(src) +
          '" alt="' +
          esc(alt) +
          '" loading="lazy" decoding="async">' +
          "</figure>"
        );
      })
      .filter(Boolean)
      .join("");

    if (wrap) wrap.hidden = !root.children.length;
  }

  function credItemStatus(item) {
    return typeof item === "object" && item?.status === "in-progress" ? "in-progress" : "verified";
  }

  function renderInProgressBadge() {
    return (
      '<span class="owner-bio-cred-badge owner-bio-cred-badge--progress" aria-hidden="true">' +
      '<svg class="owner-bio-cred-progress-svg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="10" cy="10" r="9" fill="currentColor" fill-opacity="0.14"/>' +
      '<circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M10 5.5V10l2.75 1.75" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></span>"
    );
  }

  function renderCredBadge(status, badgeUrl) {
    if (status === "in-progress") {
      return renderInProgressBadge();
    }
    if (badgeUrl) {
      return (
        '<img class="owner-bio-cred-badge" src="' +
        esc(badgeUrl) +
        '" alt="" width="20" height="20" decoding="async" aria-hidden="true">'
      );
    }
    return '<span class="owner-bio-cred-badge owner-bio-cred-badge--fallback" aria-hidden="true"></span>';
  }

  const BIO_PAGE_MS = 420;

  function measureBioPageHeight(pageEl, width) {
    if (!pageEl) return 0;
    const w = Math.max(0, Math.round(width));
    const clone = pageEl.cloneNode(true);
    clone.style.cssText =
      "position:absolute;left:-9999px;top:0;width:" +
      w +
      "px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(clone);
    const height = clone.offsetHeight;
    clone.remove();
    return height;
  }

  function readBioPagerHeights(pager) {
    const width = pager.getBoundingClientRect().width || pager.offsetWidth;
    const pageWidth = Math.max(width, 1);
    return {
      bio: measureBioPageHeight(pager.querySelector(".owner-bio-page--bio"), pageWidth),
      certs: measureBioPageHeight(pager.querySelector(".owner-bio-page--certs"), pageWidth),
    };
  }

  function syncBioPagerHeight(pager, page, animate) {
    if (!pager) return;
    const heights = pager._bioHeights || readBioPagerHeights(pager);
    pager._bioHeights = heights;
    const nextHeight = heights[page === "certs" ? "certs" : "bio"] || 0;
    if (!nextHeight) {
      pager.style.height = "auto";
      return;
    }

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!animate || reduceMotion) {
      pager.style.height = nextHeight + "px";
      return;
    }

    const startHeight = pager.getBoundingClientRect().height;
    if (Math.abs(startHeight - nextHeight) < 1) {
      pager.style.height = nextHeight + "px";
      return;
    }

    pager.style.height = startHeight + "px";
    requestAnimationFrame(() => {
      pager.style.height = nextHeight + "px";
    });
  }

  function setBioPage(page) {
    const pager = document.getElementById("owner-bio-pager");
    const toggle = document.getElementById("owner-bio-certs-toggle");
    if (!pager) return;
    const next = page === "certs" ? "certs" : "bio";
    const current = pager.dataset.bioPage || "bio";
    if (current === next || pager.classList.contains("is-transitioning")) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const pages = pager.querySelector(".owner-bio-pages");

    pager._bioHeights = readBioPagerHeights(pager);
    const endHeight = pager._bioHeights[next] || 0;
    const startHeight = pager.getBoundingClientRect().height;

    const finish = () => {
      pager.classList.remove("is-transitioning");
      pager.style.overflow = "";
      if (endHeight) pager.style.height = endHeight + "px";
      else pager.style.height = "auto";
      if (toggle) toggle.hidden = next === "certs";
    };

    pager.classList.add("is-transitioning");
    pager.style.overflow = "hidden";
    if (startHeight) pager.style.height = startHeight + "px";

    toggle?.setAttribute("aria-expanded", next === "certs" ? "true" : "false");
    if (toggle) toggle.hidden = next === "certs";

    if (reduceMotion) {
      pager.dataset.bioPage = next;
      finish();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      pages?.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(fallbackTimer);
      finish();
    };
    const onTransitionEnd = (e) => {
      if (e.target !== pages || e.propertyName !== "transform") return;
      done();
    };

    pages?.addEventListener("transitionend", onTransitionEnd);
    const fallbackTimer = window.setTimeout(done, BIO_PAGE_MS + 80);

    requestAnimationFrame(() => {
      pager.dataset.bioPage = next;
      if (endHeight) pager.style.height = endHeight + "px";
    });
  }

  function renderOwnerBio() {
    const credsRoot = document.getElementById("owner-bio-creds");
    const pager = document.getElementById("owner-bio-pager");
    const toggle = document.getElementById("owner-bio-certs-toggle");
    if (!credsRoot) return;

    const creds = Array.isArray(cfg().ownerBioCreds) ? cfg().ownerBioCreds : [];
    const badgeUrl = String(cfg().contributorsVerifiedBadgeUrl || "").trim();
    if (!creds.length) {
      if (pager) pager.hidden = true;
      if (toggle) toggle.hidden = true;
      return;
    }

    if (pager) pager.hidden = false;
    if (toggle) {
      toggle.hidden = (pager?.dataset.bioPage || "bio") === "certs";
      const label = toggle.querySelector(".owner-bio-certs-toggle-label");
      if (label) {
        label.textContent =
          creds.length === 1 ? "1 certification" : creds.length + " certifications";
      }
    }

    credsRoot.hidden = false;
    credsRoot.innerHTML = creds
      .map((item) => {
        const label = esc(typeof item === "string" ? item : item?.label || "");
        if (!label) return "";
        const status = credItemStatus(item);
        const badge = renderCredBadge(status, badgeUrl);
        const statusTag =
          status === "in-progress"
            ? '<span class="owner-bio-cred-status">In progress</span>'
            : "";
        return (
          '<li class="owner-bio-cred' +
          (status === "in-progress" ? " owner-bio-cred--in-progress" : "") +
          '">' +
          badge +
          '<span class="owner-bio-cred-label">' +
          label +
          "</span>" +
          statusTag +
          "</li>"
        );
      })
      .filter(Boolean)
      .join("");

    if (pager) {
      pager._bioHeights = readBioPagerHeights(pager);
      syncBioPagerHeight(pager, pager.dataset.bioPage || "bio", false);
    }
  }

  function wireBioPagerResize() {
    const pager = document.getElementById("owner-bio-pager");
    if (!pager || pager.dataset.resizeBound === "1") return;
    pager.dataset.resizeBound = "1";

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!pager._bioHeights) return;
        pager._bioHeights = readBioPagerHeights(pager);
        syncBioPagerHeight(pager, pager.dataset.bioPage || "bio", false);
      }, 120);
    });
  }

  function wireCertsToggle() {
    const toggle = document.getElementById("owner-bio-certs-toggle");
    const back = document.getElementById("owner-bio-certs-back");
    const pager = document.getElementById("owner-bio-pager");
    if (!toggle || !pager || toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";

    toggle.addEventListener("click", () => setBioPage("certs"));
    back?.addEventListener("click", () => setBioPage("bio"));
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (pager.dataset.bioPage === "certs") setBioPage("bio");
    });
  }

  function wirePhotoExpand() {
    const btn = document.getElementById("owner-photo-expand");
    const photo = btn?.querySelector(".owner-portfolio-photo");
    if (!btn || !photo) return;

    let dialog = document.getElementById("owner-photo-lightbox");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "owner-photo-lightbox";
      dialog.className = "owner-photo-lightbox";
      dialog.setAttribute("aria-label", "Owner photo");
      dialog.innerHTML =
        '<div class="owner-photo-lightbox-panel">' +
        '<button type="button" class="owner-photo-lightbox-close" aria-label="Close">&times;</button>' +
        '<img class="owner-photo-lightbox-img" id="owner-photo-lightbox-img" alt="" decoding="async">' +
        "</div>";
      document.body.appendChild(dialog);
    }

    const lightboxImg = dialog.querySelector("#owner-photo-lightbox-img");
    const closeBtn = dialog.querySelector(".owner-photo-lightbox-close");
    const ownerName = String(cfg().ownerName || photo.alt || "Owner").trim();

    btn.addEventListener("click", () => {
      if (!lightboxImg) return;
      const src = photo.currentSrc || photo.src;
      lightboxImg.alt = photo.alt || ownerName;

      const open = () => {
        if (typeof dialog.showModal === "function") dialog.showModal();
      };

      if (lightboxImg.src !== src) lightboxImg.src = src;
      if (lightboxImg.complete && lightboxImg.naturalWidth > 0) {
        open();
        return;
      }
      lightboxImg.onload = () => {
        lightboxImg.onload = null;
        open();
      };
    });

    closeBtn?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
  }

  function init() {
    if (document.body.dataset.page !== "owner" && document.body.dataset.page !== "about") return;
    wirePhoneLink();
    renderGallery();
    renderOwnerBio();
    wireBioPagerResize();
    wireCertsToggle();
    wirePhotoExpand();
  }

  global.OwnerContact = { init };

  global.addEventListener("site-unlocked", init);
  document.addEventListener("DOMContentLoaded", () => {
    if (global.sessionStorage?.getItem("lpc_site_unlock") === "1") init();
  });
  if (document.body.dataset.appBooted === "1") init();
})(window);
