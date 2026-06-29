/**
 * All links · grouped hub built from CourseModules + SITE_CONFIG.
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

  function shortUrl(url) {
    return String(url || "")
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "");
  }

  function internalRow(name, href, hint) {
    return { kind: "internal", name, href, hint };
  }

  function configRow(name, key, opts) {
    return {
      kind: "config",
      name,
      config: key,
      external: opts?.external !== false,
      short: !!opts?.short,
      hideIfEmpty: !!opts?.hideIfEmpty,
      mailto: key === "email",
      tel: key === "phone",
    };
  }

  function externalRow(name, href, hint) {
    return { kind: "external", name, href, hint };
  }

  function courseRows() {
    const CM = global.CourseModules;
    const rows = [];
    if (CM?.list && CM.href) {
      CM.list().forEach((mod) => {
        rows.push(
          internalRow(
            mod.title,
            CM.href(mod),
            "Module " + mod.num + (mod.duration ? " · " + mod.duration : "")
          )
        );
      });
    } else {
      [
        ["introduction", "Start Here"],
        ["business", "The Business"],
        ["setup-accounts", "Setup Accounts"],
        ["dashboard", "Platform Tour"],
        ["everyday-tasks", "Sales Tasks"],
      ].forEach(([id, title], i) => {
        rows.push(internalRow(title, "course-module.html?m=" + id, "Module " + (i + 1)));
      });
    }
    rows.push(
      internalRow("Get started (setup survey)", "setup.html", "PIN + payout setup"),
      internalRow("Course hub", "course.html", "Auto-redirect after sign-in")
    );

    const videos = cfg().courseModuleVideos || {};
    Object.keys(videos).forEach((key) => {
      const url = String(videos[key] || "").trim();
      if (!url) return;
      const mod = CM?.get?.(key);
      const label = mod ? mod.title : key;
      rows.push(externalRow("Video · " + label, url, "YouTube"));
    });

    const fallback = String(cfg().onboardingVideoUrl || "").trim();
    if (fallback) {
      rows.push({
        kind: "config",
        name: "Course video · legacy fallback",
        config: "onboardingVideoUrl",
        external: true,
        short: true,
        hideIfEmpty: true,
      });
    }

    return rows;
  }

  function buildSections() {
    const c = cfg();
    return [
      {
        id: "sales",
        eyebrow: "Work",
        title: "Sales tools",
        icon: "layout-dashboard",
        links: [
          internalRow("Dashboard", "dashboard.html", "Log sales & track commission"),
          internalRow("Lead Finder", "leads.html", "Businesses without a website"),
          internalRow("Lead Builder", "template.html", "Send leads to the team"),
          internalRow("Call scripts", "scripts.html", "Phone & objection scripts"),
          internalRow("Text & email templates", "scripts.html#text-email-templates"),
          internalRow("Pending businesses", "dashboard.html", "Leads awaiting follow-up"),
        ],
      },
      {
        id: "course",
        eyebrow: "Learn",
        title: "Course & training",
        icon: "book-open",
        links: courseRows(),
      },
      {
        id: "help",
        eyebrow: "Help",
        title: "Help & account",
        icon: "help-circle",
        links: [
          internalRow("FAQ", "faq.html"),
          internalRow("Ask the team", "faq.html", "Team Q&A at top"),
          internalRow("How you get paid", "faq.html#how-you-get-paid"),
          internalRow("Settings", "settings.html", "Name, photo, payout"),
          internalRow("Feedback", "feedback.html", "Product ideas · not bugs"),
          internalRow("Bug Bounty", "bug-bounty.html", "Report broken features"),
          internalRow("All links", "resources.html", "This page"),
          internalRow("About us", "about.html"),
          internalRow("About us · Owner", "about.html#owner"),
          internalRow("About us · Team", "about.html#team"),
          internalRow("Help guide", "help.html", "Sales team reference"),
        ],
      },
      {
        id: "connect",
        eyebrow: "Connect",
        title: "Team & contact",
        icon: "users",
        links: [
          configRow("Team business chat", "telegramTeam", { short: true }),
          configRow(
            (c.payoutTelegramName || "Website Agency") + " (payout Telegram)",
            "payoutTelegramUrl",
            { short: true }
          ),
          configRow("Contributors · invite / apply", "contributorsShareUrl", {
            short: true,
          }),
          configRow("Owner Telegram", "ownerTelegram", { short: true }),
          configRow("Support Telegram", "supportTelegram", { short: true }),
          externalRow("Owner store", c.ownerStoreUrl),
          externalRow("Book a call (Cal.com)", c.ownerCalUrl),
          configRow("Owner email", "email"),
          configRow("Owner phone", "phone"),
        ],
      },
      {
        id: "reference",
        eyebrow: "Reference",
        title: "Legal & redirects",
        icon: "shield",
        links: [
          internalRow("Privacy policy", "privacy.html"),
          internalRow("Terms of service", "terms.html"),
          internalRow("accounts.html", "accounts.html", "→ setup.html"),
          internalRow("earnings.html", "earnings.html", "→ FAQ How you get paid"),
          internalRow("everyday-tasks.html", "everyday-tasks.html", "→ Course Sales Tasks"),
          internalRow("workflow.html", "workflow.html", "→ Course Platform Tour"),
          internalRow("Sign in", "index.html", "PIN gate"),
        ],
      },
    ];
  }

  function buildLinks() {
    return buildSections().flatMap((section) => section.links);
  }

  function linkFilterTags(link, sectionId) {
    const tags = [sectionId];
    if (link.kind === "internal") tags.push("internal");
    if (link.kind === "external") tags.push("external");
    if (link.kind === "config") tags.push("external");
    if (sectionId === "course") tags.push("course");
    if (link.name && /course|video|module/i.test(link.name)) tags.push("course");
    return tags.join(" ");
  }

  function linkSearchText(link) {
    const parts = [link.name, link.hint, link.href, link.config].filter(Boolean);
    if (link.kind === "external") parts.push(shortUrl(link.href));
    return parts.join(" ").toLowerCase();
  }

  function rowIcon(link, sectionIcon) {
    if (link.kind === "external") {
      if (/video|youtube/i.test(link.name + (link.hint || ""))) return "video";
      if (/telegram/i.test(link.name)) return "message-square";
      if (/cal\.com|call/i.test(link.name)) return "phone";
      if (/store/i.test(link.name)) return "globe";
      return "external-link";
    }
    if (link.kind === "config") {
      if (link.mailto) return "mail";
      if (link.tel) return "phone";
      if (/telegram/i.test(link.name)) return "message-square";
      return "external-link";
    }
    if (/dashboard|pending|sale/i.test(link.name)) return "layout-dashboard";
    if (/lead finder|leads/i.test(link.name)) return "search";
    if (/builder|template|send/i.test(link.name)) return "file-plus";
    if (/script|call|text|email/i.test(link.name)) return "phone";
    if (/bug/i.test(link.name)) return "bug";
    if (/feedback/i.test(link.name)) return "message-square";
    if (/faq|help|paid/i.test(link.name)) return "help-circle";
    if (/settings/i.test(link.name)) return "settings";
    if (/about|owner|team|contributor/i.test(link.name)) return "users";
    if (/privacy|terms|legal|sign in/i.test(link.name)) return "shield";
    if (/course|setup|video|module/i.test(link.name + (link.hint || ""))) return "book-open";
    return sectionIcon || "file-text";
  }

  function renderPathCell(link) {
    if (link.kind === "internal") {
      return esc(link.href);
    }
    if (link.kind === "external") {
      const href = String(link.href || "").trim();
      if (!href) return "-";
      return esc(shortUrl(href));
    }
    if (link.kind === "config") {
      return "-";
    }
    return "";
  }

  function renderRow(link, section) {
    const tags = linkFilterTags(link, section.id);
    const search = esc(linkSearchText(link));
    const icon = rowIcon(link, section.icon);
    const path = renderPathCell(link);
    const hint = link.hint
      ? `<span class="links-hub-row-hint">${esc(link.hint)}</span>`
      : "";
    const badge =
      link.kind === "external" || (link.kind === "config" && link.external && !link.mailto && !link.tel)
        ? '<span class="links-hub-row-badge">External</span>'
        : link.kind === "internal"
          ? '<span class="links-hub-row-badge links-hub-row-badge--internal">Internal</span>'
          : "";

    if (link.kind === "internal") {
      return (
        `<a class="links-hub-row links-hub-row--internal" href="${esc(link.href)}"` +
        ` data-link-tags="${esc(tags)}" data-link-search="${search}">` +
        `<span class="links-hub-row-icon" data-icon="${esc(icon)}" data-icon-class="links-hub-ico" aria-hidden="true"></span>` +
        `<span class="links-hub-row-main">` +
        `<span class="links-hub-row-name">${esc(link.name)}</span>${hint}` +
        `</span>` +
        `<span class="links-hub-row-path">${path}</span>` +
        badge +
        `<span class="links-hub-row-chevron" data-icon="chevron-right" data-icon-class="links-hub-ico links-hub-ico-chevron" aria-hidden="true"></span>` +
        `</a>`
      );
    }

    if (link.kind === "external") {
      const href = String(link.href || "").trim();
      if (!href) return "";
      return (
        `<a class="links-hub-row links-hub-row--external" href="${esc(href)}" target="_blank" rel="noopener"` +
        ` data-link-tags="${esc(tags)}" data-link-search="${search}">` +
        `<span class="links-hub-row-icon" data-icon="${esc(icon)}" data-icon-class="links-hub-ico" aria-hidden="true"></span>` +
        `<span class="links-hub-row-main">` +
        `<span class="links-hub-row-name">${esc(link.name)}</span>${hint}` +
        `</span>` +
        `<span class="links-hub-row-path">${path}</span>` +
        badge +
        `<span class="links-hub-row-chevron" data-icon="external-link" data-icon-class="links-hub-ico links-hub-ico-chevron" aria-hidden="true"></span>` +
        `</a>`
      );
    }

    if (link.kind === "config") {
      const attrs =
        'data-config="' +
        esc(link.config) +
        '" href="#" data-config-text' +
        (link.short ? ' data-config-short' : "") +
        (link.hideIfEmpty ? ' data-config-hide-row' : "");
      const attrMail = link.mailto ? ' data-config-attr="href"' : "";
      const attrTel = link.tel ? ' data-config-attr="href"' : "";
      const target = link.external && !link.mailto && !link.tel
        ? ' target="_blank" rel="noopener"'
        : "";
      return (
        `<a class="links-hub-row links-hub-row--config" ${attrs}${attrMail}${attrTel}${target}` +
        ` data-link-tags="${esc(tags)}" data-link-search="${search}"` +
        ` data-config-row="${esc(link.config)}">` +
        `<span class="links-hub-row-icon" data-icon="${esc(icon)}" data-icon-class="links-hub-ico" aria-hidden="true"></span>` +
        `<span class="links-hub-row-main">` +
        `<span class="links-hub-row-name">${esc(link.name)}</span>${hint}` +
        `</span>` +
        `<span class="links-hub-row-path links-hub-row-path--config">-</span>` +
        badge +
        `<span class="links-hub-row-chevron" data-icon="external-link" data-icon-class="links-hub-ico links-hub-ico-chevron" aria-hidden="true"></span>` +
        `</a>`
      );
    }

    return "";
  }

  function renderSection(section) {
    const rows = (section.links || [])
      .map((link) => renderRow(link, section))
      .filter(Boolean)
      .join("");
    if (!rows) return "";

    return (
      `<section class="links-hub-section card" data-links-section="${esc(section.id)}">` +
      `<header class="links-hub-section-head">` +
      `<p class="links-hub-section-eyebrow">${esc(section.eyebrow)}</p>` +
      `<div class="links-hub-section-title-row">` +
      `<span class="links-hub-section-icon" data-icon="${esc(section.icon)}" data-icon-class="links-hub-section-ico" aria-hidden="true"></span>` +
      `<h2 class="links-hub-section-title">${esc(section.title)}</h2>` +
      `<span class="links-hub-section-count" data-section-count="${esc(section.id)}">0</span>` +
      `</div>` +
      `</header>` +
      `<div class="links-hub-list">${rows}</div>` +
      `<p class="links-hub-section-empty muted" hidden>No links in this section match your search.</p>` +
      `</section>`
    );
  }

  function renderHub(sections) {
    const body = (sections || []).map(renderSection).filter(Boolean).join("");
    return body;
  }

  function applyConfigLinks(root) {
    document.querySelectorAll("#resources-links-root [data-config]").forEach((el) => {
      const key = el.dataset.config;
      const val = cfg()[key];
      if (!val) {
        const row =
          el.closest("[data-config-row]") ||
          (el.hasAttribute("data-config-hide-row") ? el : null);
        if (row) row.hidden = true;
        return;
      }
      if (el.hasAttribute("data-config-paragraphs")) return;
      const pathEl = el.querySelector(".links-hub-row-path--config") || el.querySelector(".links-hub-row-path");
      if (el.hasAttribute("data-config-text")) {
        let text = val;
        if (el.hasAttribute("data-config-short")) text = shortUrl(val);
        if (pathEl) pathEl.textContent = text;
        else el.textContent = text;
      }
      if (el.dataset.configAttr) {
        el.setAttribute(el.dataset.configAttr, val);
      } else if (el.tagName === "A") {
        if (key === "email") el.href = "mailto:" + val;
        else if (key === "phone") {
          const digits = String(val).replace(/\D/g, "");
          el.href = digits.length === 10 ? "tel:+1" + digits : "tel:" + digits;
        } else el.href = val;
      }
    });
  }

  function countVisibleRows(root) {
    let total = 0;
    let visible = 0;
    root.querySelectorAll(".links-hub-row").forEach((row) => {
      if (row.hidden) return;
      total += 1;
      if (!row.classList.contains("is-filtered-out")) visible += 1;
    });
    return { total, visible };
  }

  function updateSectionCounts(root) {
    root.querySelectorAll(".links-hub-section").forEach((section) => {
      const rows = [...section.querySelectorAll(".links-hub-row")].filter(
        (row) => !row.hidden && !row.classList.contains("is-filtered-out")
      );
      const countEl = section.querySelector(".links-hub-section-count");
      if (countEl) countEl.textContent = String(rows.length);
      const emptyEl = section.querySelector(".links-hub-section-empty");
      const hasAny = [...section.querySelectorAll(".links-hub-row")].some((row) => !row.hidden);
      if (emptyEl) emptyEl.hidden = rows.length > 0 || !hasAny;
      section.hidden = hasAny && rows.length === 0;
    });
  }

  function applyFilters(root) {
    const q = (document.getElementById("links-search")?.value || "").trim().toLowerCase();
    const page = root.closest(".resources-page");
    const activeFilter =
      page?.querySelector(".links-hub-filter.is-active")?.dataset.linksFilter || "all";

    root.querySelectorAll(".links-hub-row").forEach((row) => {
      const tags = row.dataset.linkTags || "";
      const search = row.dataset.linkSearch || "";
      const matchesFilter =
        activeFilter === "all" || tags.split(/\s+/).includes(activeFilter);
      const matchesSearch = !q || search.includes(q);
      const show = matchesFilter && matchesSearch;
      row.classList.toggle("is-filtered-out", !show);
    });

    updateSectionCounts(root);

    const { total, visible } = countVisibleRows(root);
    const totalEl = document.getElementById("links-stat-total");
    const visibleEl = document.getElementById("links-stat-visible");
    if (totalEl) totalEl.textContent = String(total);
    if (visibleEl) visibleEl.textContent = String(visible);

    const empty = root.querySelector(".links-hub-empty");
    if (empty) empty.hidden = visible > 0;
  }

  function bindFilters(root) {
    const page = root.closest(".resources-page");
    if (page?.dataset.linksFiltersBound === "1") {
      applyFilters(root);
      return;
    }
    if (page) page.dataset.linksFiltersBound = "1";

    const search = document.getElementById("links-search");
    search?.addEventListener("input", () => applyFilters(root));

    page?.querySelectorAll(".links-hub-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        page?.querySelectorAll(".links-hub-filter").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        applyFilters(root);
      });
    });
  }

  function render() {
    const root = document.getElementById("resources-links-root");
    if (!root) return;

    const sections = buildSections();
    root.innerHTML =
      renderHub(sections) +
      '<p class="links-hub-empty muted" hidden>No links match your search. Try a different keyword or filter.</p>';

    applyConfigLinks(root);

    if (global.SiteIcons) global.SiteIcons.initIcons(root);
    if (global.SiteIcons) {
      const toolbar = document.querySelector(".links-hub-toolbar");
      if (toolbar) global.SiteIcons.initIcons(toolbar);
    }

    bindFilters(root);
    applyFilters(root);
  }

  function init() {
    if (document.body.dataset.page !== "resources") return;
    render();
    global.addEventListener("rep-settings-ready", render);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.ResourcesLinks = { render, buildLinks, buildSections };
})(window);
