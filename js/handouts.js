/**
 * Handouts · Daily tools channel with printable reference resources
 * (package pricing, the sales-call flow diagram, and an objection cheat sheet).
 */
(function (global) {
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Mirrors the Lead Builder packages · keep in sync with TPL_PACKAGE_DETAILS in app.js.
  const PACKAGES = [
    {
      price: "$500",
      monthly: "+ $10/mo hosting & maintenance",
      tier: "Basic package",
      items: [
        "1-page professional website",
        "Mobile-responsive design",
        "Contact form & online booking",
        "Click-to-call & map directions",
        "Infinite redesigns",
        "Hosting & maintenance included",
      ],
    },
    {
      price: "$700",
      monthly: "+ $10/mo hosting & maintenance",
      tier: "Standard package",
      items: [
        "Unlimited pages",
        "Mobile-responsive on phones & tablets",
        "Contact form & booking + photo gallery",
        "Basic SEO setup",
        "Infinite redesigns",
        "Hosting & maintenance included",
      ],
    },
    {
      price: "$1,000",
      monthly: "+ $10/mo hosting & maintenance",
      tier: "Deluxe package",
      items: [
        "Unlimited pages",
        "Run ads & ad campaigns",
        "Optimized mobile-responsive design",
        "Advanced forms & online booking system",
        "Google Business Profile setup",
        "On-page SEO + social links",
        "Infinite redesigns",
        "Hosting & maintenance included",
      ],
    },
    {
      price: "$1,500",
      monthly: "+ $10/mo hosting & maintenance",
      tier: "Premium package",
      items: [
        "Unlimited pages + priority build",
        "Ads + ongoing ad management",
        "Pixel-perfect mobile-responsive design",
        "Full booking system, forms & reviews section",
        "Advanced SEO optimization",
        "Google Business Profile setup",
        "Priority support & monthly updates",
        "Infinite redesigns + priority turnaround",
        "Hosting & maintenance included",
      ],
    },
  ];

  const DAILY_WORKFLOW = [
    {
      step: "1",
      parts: ["Open Lead Finder"],
      detail:
        "Our leads list of businesses that don\u2019t already have a website. Use the \u201CNo website\u201D filter for the best fits.",
    },
    {
      step: "2",
      parts: ["Pick a business", "Build Lead"],
      detail:
        "Choose one business from the list, then click Build Lead on its card to open Lead Builder with the details prefilled.",
    },
    {
      step: "3",
      parts: ["Call business", "Pitch website"],
      detail:
        "Dial from the card and use Call Scripts to offer the free demo site. Talk to the owner or decision-maker. Not interested? Thank them and go back to step 2 \u2014 do not post the lead.",
    },
    {
      step: "4",
      parts: ["If interested", "Fill Lead Builder"],
      detail:
        "Build Lead prefills most fields. Match your quoted price, then add the phone number, owner name, and preference.",
      ask: {
        head: "When they\u2019re interested, close with these 3 questions",
        items: [
          "Direct link or booked meeting?",
          "Confirm the best phone number.",
          "Get their first name (and spelling).",
        ],
      },
    },
    {
      step: "5",
      parts: ["Send lead", "Manager gets the details"],
      detail:
        "Click Send lead when every field is filled \u2014 the business moves to Pending and your manager gets the details.",
    },
  ];

  const LEAD_QUALITY = [
    "No website \u2014 or an outdated / broken one",
    "Local business with a working phone number",
    "Owner or decision-maker can be reached",
    "Active business (recent reviews, open hours)",
    "Clearly benefits from calls or online bookings",
    "Not a national chain or franchise",
  ];

  const CALL_RESPONSES = [
    {
      when: "Not the owner",
      then: "Ask for the owner by name or get the best callback time \u2014 then move on.",
    },
    {
      when: "Voicemail / no answer",
      then: "Leave a 10-second message, text the demo link, and call the next lead.",
    },
    {
      when: "\u201CI\u2019m busy right now\u201D",
      then: "\u201CNo problem \u2014 it\u2019s already built. I\u2019ll text the link so you can peek in 20 seconds.\u201D",
    },
    {
      when: "\u201CHow much is it?\u201D",
      then: "\u201CFree to look \u2014 only $500 if you love it.\u201D Reframe the value before the price.",
    },
    {
      when: "\u201CYes, show me\u201D",
      then: "Send the link or book a time, then run the 3 closing questions.",
      good: true,
    },
    {
      when: "\u201CNot interested\u201D",
      then: "Thank them and exit politely. Do not post the lead.",
      bad: true,
    },
  ];

  const PACKAGE_PICKER = [
    {
      when: "Brand-new or tiny budget \u2014 just needs to exist online",
      price: "$500",
      tier: "Basic",
    },
    {
      when: "Wants several pages, a gallery and online booking",
      price: "$700",
      tier: "Standard",
    },
    {
      when: "Wants to run ads and get found on Google",
      price: "$1,000",
      tier: "Deluxe",
    },
    {
      when: "Established \u2014 wants the full build + priority support",
      price: "$1,500",
      tier: "Premium",
    },
  ];

  const DOS_DONTS = {
    dos: [
      "Be upfront that it\u2019s a sales call.",
      "Lead with the free demo \u2014 it\u2019s already built.",
      "Talk to the owner or decision-maker.",
      "Confirm the best phone number before hanging up.",
      "Get the first name and its spelling.",
      "Send the lead the moment every field is filled.",
    ],
    donts: [
      "Don\u2019t pitch the price before showing value.",
      "Don\u2019t argue \u2014 one reframe, then exit politely.",
      "Don\u2019t post a lead for a \u201Cnot interested\u201D business.",
      "Don\u2019t leave fields blank in the Lead Builder.",
      "Don\u2019t promise features outside the package.",
      "Don\u2019t forget to log the call outcome.",
    ],
  };

  const OBJECTIONS = [
    {
      q: "\u201CWe already have a website / Facebook.\u201D",
      a: "\u201CTotally fair \u2014 this demo is for customers who want something they can bookmark and share. Want me to text the link so you can compare?\u201D",
    },
    {
      q: "\u201CHow much is it?\u201D",
      a: "\u201CIt\u2019s free to look. If you love it, packages start at $500 \u2014 agencies usually charge $3,000\u2013$10,000+.\u201D",
    },
    {
      q: "\u201CI\u2019m too busy right now.\u201D",
      a: "\u201CNo problem \u2014 it\u2019s already built. I\u2019ll text a direct link so you can peek in 20 seconds whenever you want.\u201D",
    },
    {
      q: "\u201CSend me some info.\u201D",
      a: "\u201CHappy to \u2014 would a direct link or a quick call work better? The demo is already done, so there\u2019s nothing to wait on.\u201D",
    },
    {
      q: "\u201CNot interested.\u201D",
      a: "\u201CNo worries at all \u2014 I appreciate your time. Have a great rest of your day!\u201D (polite exit, don\u2019t post the lead)",
    },
    {
      q: "\u201CI already have a guy / nephew who does it.\u201D",
      a: "\u201CLove that \u2014 keep them for updates. This is already built and live to look at, so there\u2019s no cost to compare. Want the link?\u201D",
    },
    {
      q: "\u201CIs this a scam? How are you doing this for free?\u201D",
      a: "\u201CFair question. The demo really is free \u2014 I only get paid if you love it and keep it. No card, no commitment to look.\u201D",
    },
    {
      q: "\u201CWhat\u2019s the monthly for?\u201D",
      a: "\u201CJust $10/mo covers hosting, updates, and keeping it online \u2014 we handle all the tech so you never have to.\u201D",
    },
    {
      q: "\u201CCan you make changes later?\u201D",
      a: "\u201CAbsolutely \u2014 every package includes infinite redesigns. Just tell us what to tweak and we handle it.\u201D",
    },
    {
      q: "\u201CCall me back later.\u201D",
      a: "\u201CHappy to \u2014 what\u2019s the best time? In the meantime I\u2019ll text the link so you can peek for 20 seconds whenever.\u201D",
    },
    {
      q: "\u201CHow do I know it\u2019ll bring customers?\u201D",
      a: "\u201CIt shows up when people Google you, takes bookings, and clicks to call \u2014 the stuff that turns searches into customers.\u201D",
    },
  ];

  const PRINTER_ICO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';

  const CHEVRON_ICO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  function printBtn(handoutId) {
    return (
      '<button type="button" class="handout-print-btn" data-print-handout="' +
      esc(handoutId) +
      '" aria-label="Print this handout">' +
      PRINTER_ICO +
      "<span>Print</span></button>"
    );
  }

  function pricingCard() {
    const cols = PACKAGES.map((p) => {
      const items = p.items
        .map((it) => '<li class="handout-pkg-item">' + esc(it) + "</li>")
        .join("");
      return (
        '<div class="handout-pkg">' +
        '<div class="handout-pkg-head">' +
        '<span class="handout-pkg-price">' +
        esc(p.price) +
        "</span>" +
        '<span class="handout-pkg-monthly">' +
        esc(p.monthly) +
        "</span>" +
        '<span class="handout-pkg-tier">' +
        esc(p.tier) +
        "</span>" +
        "</div>" +
        '<ul class="handout-pkg-list">' +
        items +
        "</ul>" +
        "</div>"
      );
    }).join("");

    return (
      '<section class="card handout-card" data-handout="pricing">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Packages &amp; pricing</h2>' +
      '<p class="handout-card-sub">Each price is a package \u00B7 higher tiers include everything below plus more.</p>' +
      "</div>" +
      printBtn("pricing") +
      "</header>" +
      '<div class="handout-pkg-grid">' +
      cols +
      "</div>" +
      "</section>"
    );
  }

  function objectionCard() {
    const rows = OBJECTIONS.map(
      (o) =>
        '<div class="handout-obj">' +
        '<p class="handout-obj-q">' +
        esc(o.q) +
        "</p>" +
        '<p class="handout-obj-a">' +
        esc(o.a) +
        "</p>" +
        "</div>"
    ).join("");

    return (
      '<section class="card handout-card" data-handout="objections">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Objection cheat sheet</h2>' +
      '<p class="handout-card-sub">Quick, friendly responses to the most common pushback.</p>' +
      "</div>" +
      printBtn("objections") +
      "</header>" +
      '<div class="handout-obj-list">' +
      rows +
      "</div>" +
      "</section>"
    );
  }

  function workflowCard() {
    const steps = DAILY_WORKFLOW.map((s) => {
      const title = (s.parts || [s.title || ""])
        .map((p) => '<span class="handout-step-part">' + esc(p) + "</span>")
        .join('<span class="handout-step-arrow" aria-hidden="true">\u2192</span>');

      const ask = s.ask
        ? '<div class="handout-step-ask">' +
          '<p class="handout-step-ask-head">' +
          esc(s.ask.head) +
          "</p>" +
          '<ol class="handout-step-ask-list">' +
          s.ask.items.map((it) => "<li>" + esc(it) + "</li>").join("") +
          "</ol>" +
          "</div>"
        : "";

      return (
        '<li class="handout-step">' +
        '<div class="handout-step-marker">' +
        '<span class="handout-step-num">' +
        esc(s.step) +
        "</span>" +
        "</div>" +
        '<div class="handout-step-body">' +
        '<p class="handout-step-title">' +
        title +
        "</p>" +
        '<p class="handout-step-detail">' +
        esc(s.detail) +
        "</p>" +
        ask +
        "</div>" +
        "</li>"
      );
    }).join("");

    return (
      '<section class="card handout-card" data-handout="workflow">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Daily workflow \u00B7 sales tasks</h2>' +
      '<p class="handout-card-sub">The 5-step loop to run every day, from finding a lead to sending it.</p>' +
      "</div>" +
      printBtn("workflow") +
      "</header>" +
      '<ol class="handout-steps">' +
      steps +
      "</ol>" +
      "</section>"
    );
  }

  function dosDontsCard() {
    const list = (arr) =>
      arr.map((t) => "<li>" + esc(t) + "</li>").join("");

    return (
      '<section class="card handout-card" data-handout="dosdonts">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Do\u2019s &amp; Don\u2019ts</h2>' +
      '<p class="handout-card-sub">Habits that close deals \u2014 and the ones that cost them.</p>' +
      "</div>" +
      printBtn("dosdonts") +
      "</header>" +
      '<div class="handout-dd-grid">' +
      '<div class="handout-dd handout-dd--do">' +
      '<p class="handout-dd-head">Do</p>' +
      '<ul class="handout-dd-list">' +
      list(DOS_DONTS.dos) +
      "</ul>" +
      "</div>" +
      '<div class="handout-dd handout-dd--dont">' +
      '<p class="handout-dd-head">Don\u2019t</p>' +
      '<ul class="handout-dd-list">' +
      list(DOS_DONTS.donts) +
      "</ul>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function qualificationCard() {
    const items = LEAD_QUALITY.map(
      (t) =>
        '<li class="handout-check-item">' +
        '<span class="handout-check-box" aria-hidden="true"></span>' +
        '<span class="handout-check-text">' +
        esc(t) +
        "</span>" +
        "</li>"
    ).join("");

    return (
      '<section class="card handout-card" data-handout="qualify">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Is this a good lead?</h2>' +
      '<p class="handout-card-sub">Tick the boxes before you dial \u2014 the more checks, the better the lead.</p>' +
      "</div>" +
      printBtn("qualify") +
      "</header>" +
      '<ul class="handout-check-list">' +
      items +
      "</ul>" +
      "</section>"
    );
  }

  function callResponseCard() {
    const rows = CALL_RESPONSES.map((r) => {
      const tone = r.good
        ? " handout-branch--good"
        : r.bad
        ? " handout-branch--bad"
        : "";
      return (
        '<li class="handout-branch' +
        tone +
        '">' +
        '<span class="handout-branch-when">' +
        esc(r.when) +
        "</span>" +
        '<span class="handout-branch-arrow" aria-hidden="true">\u2192</span>' +
        '<span class="handout-branch-then">' +
        esc(r.then) +
        "</span>" +
        "</li>"
      );
    }).join("");

    return (
      '<section class="card handout-card" data-handout="callresponse">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">They answered \u2014 now what?</h2>' +
      '<p class="handout-card-sub">Match what they say to your next move.</p>' +
      "</div>" +
      printBtn("callresponse") +
      "</header>" +
      '<ul class="handout-branch-flow">' +
      rows +
      "</ul>" +
      "</section>"
    );
  }

  function packagePickerCard() {
    const rows = PACKAGE_PICKER.map(
      (p) =>
        '<li class="handout-pick">' +
        '<span class="handout-pick-when">' +
        esc(p.when) +
        "</span>" +
        '<span class="handout-branch-arrow" aria-hidden="true">\u2192</span>' +
        '<span class="handout-pick-badge">' +
        '<span class="handout-pick-price">' +
        esc(p.price) +
        "</span>" +
        '<span class="handout-pick-tier">' +
        esc(p.tier) +
        "</span>" +
        "</span>" +
        "</li>"
    ).join("");

    return (
      '<section class="card handout-card" data-handout="packagepick">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Which package do I pitch?</h2>' +
      '<p class="handout-card-sub">Quick match from what the owner needs to the right tier.</p>' +
      "</div>" +
      printBtn("packagepick") +
      "</header>" +
      '<ul class="handout-pick-list">' +
      rows +
      "</ul>" +
      "</section>"
    );
  }

  function moneyToNum(v) {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function tierForPrice(price) {
    const hit = PACKAGES.find((p) => p.price === price);
    return hit ? hit.tier.replace(/\s*package$/i, "") : "";
  }

  function commissionCard() {
    const cfg = global.SITE_CONFIG || {};
    const pkgs = Array.isArray(cfg.packages) ? cfg.packages : [];
    const max = pkgs.reduce((m, p) => Math.max(m, moneyToNum(p.commission)), 0) || 1;
    const rows = pkgs
      .map((p) => {
        const amount = moneyToNum(p.commission);
        const pct = Math.max(8, Math.round((amount / max) * 100));
        return (
          '<div class="handout-earn-row">' +
          '<div class="handout-earn-label">' +
          '<span class="handout-earn-price">' +
          esc(p.upfront) +
          "</span>" +
          '<span class="handout-earn-tier">' +
          esc(tierForPrice(p.upfront)) +
          "</span>" +
          "</div>" +
          '<div class="handout-earn-track">' +
          '<div class="handout-earn-bar" style="width:' +
          pct +
          '%">' +
          '<span class="handout-earn-val">' +
          esc(p.commission) +
          "</span>" +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<section class="card handout-card" data-handout="commission">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">What you earn per sale</h2>' +
      '<p class="handout-card-sub">You keep <strong>40%</strong> of every upfront sale \u2014 close bigger packages to earn more.</p>' +
      "</div>" +
      printBtn("commission") +
      "</header>" +
      '<div class="handout-earn">' +
      rows +
      "</div>" +
      '<p class="handout-earn-foot">Commission shown is 40% of the upfront price. The $10/mo hosting fee is billed separately by the company.</p>' +
      "</section>"
    );
  }

  function contactCard() {
    const cfg = global.SITE_CONFIG || {};
    const ICO = {
      phone:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
      mail:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
      telegram:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4.5 2.5 12l6 2 2 6 3-4 5 4z"/><path d="m8.5 14 9-7"/></svg>',
      cal:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      store:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9 4 4h16l1 5"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/></svg>',
    };

    const row = (icon, label, value, href) => {
      if (!value) return "";
      const val = href
        ? '<a class="handout-contact-val" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(value) + "</a>"
        : '<span class="handout-contact-val">' + esc(value) + "</span>";
      return (
        '<li class="handout-contact-row">' +
        '<span class="handout-contact-ico" aria-hidden="true">' +
        icon +
        "</span>" +
        '<span class="handout-contact-text">' +
        '<span class="handout-contact-label">' +
        esc(label) +
        "</span>" +
        val +
        "</span>" +
        "</li>"
      );
    };

    const name = String(cfg.ownerName || "your manager").trim();
    const phone = String(cfg.phone || "").trim();
    const tel = phone ? "tel:" + phone.replace(/[^0-9+]/g, "") : "";
    const email = String(cfg.email || "").trim();
    const tg = String(cfg.ownerTelegram || cfg.supportTelegram || "").trim();
    const tgHandle = String(cfg.ownerTelegramHandle || cfg.ownerHandle || "Telegram").trim();
    const cal = String(cfg.ownerCalUrl || "").trim();
    const store = String(cfg.ownerStoreUrl || "").trim();

    const rows =
      row(ICO.phone, "Call or text", phone, tel) +
      row(ICO.mail, "Email", email, email ? "mailto:" + email : "") +
      row(ICO.telegram, "Telegram", tgHandle, tg) +
      row(ICO.cal, "Book a call", cal.replace(/^https?:\/\//, ""), cal) +
      row(ICO.store, "Store", store.replace(/^https?:\/\//, ""), store);

    return (
      '<section class="card handout-card" data-handout="contact">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Need help? Contact ' +
      esc(name) +
      "</h2>" +
      '<p class="handout-card-sub">Your manager \u2014 reach out anytime you\u2019re stuck on a call or a deal.</p>' +
      "</div>" +
      printBtn("contact") +
      "</header>" +
      '<ul class="handout-contact-list">' +
      rows +
      "</ul>" +
      "</section>"
    );
  }

  function callLogCard() {
    const stats = ["Calls made", "Answered", "Demos sent", "Closes"]
      .map(
        (s) =>
          '<div class="handout-log-stat">' +
          '<span class="handout-log-stat-num"></span>' +
          '<span class="handout-log-stat-label">' +
          esc(s) +
          "</span>" +
          "</div>"
      )
      .join("");

    let rows = "";
    for (let i = 1; i <= 12; i += 1) {
      rows +=
        "<tr>" +
        '<td class="handout-log-num">' +
        i +
        "</td>" +
        "<td></td><td></td>" +
        '<td class="handout-log-result"></td>' +
        "</tr>";
    }

    return (
      '<section class="card handout-card" data-handout="calllog">' +
      '<header class="handout-card-head">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">Daily call log</h2>' +
      '<p class="handout-card-sub">Print one each day to track your calls and stay on pace for your goal.</p>' +
      "</div>" +
      printBtn("calllog") +
      "</header>" +
      '<div class="handout-log-meta">' +
      '<span class="handout-log-field">Date <span class="handout-log-line"></span></span>' +
      '<span class="handout-log-field">Daily goal <span class="handout-log-line"></span></span>' +
      "</div>" +
      '<div class="handout-log-stats">' +
      stats +
      "</div>" +
      '<table class="handout-log-table">' +
      "<thead><tr>" +
      '<th class="handout-log-num">#</th>' +
      "<th>Business</th><th>Phone</th><th>Result</th>" +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody>" +
      "</table>" +
      "</section>"
    );
  }

  function collapseCard(id, title, sub, loadingLabel) {
    return (
      '<section class="card handout-card handout-collapse" data-handout="' +
      esc(id) +
      '">' +
      '<header class="handout-card-head handout-collapse-head" data-collapse-toggle role="button" tabindex="0" aria-expanded="false" aria-controls="collapse-body-' +
      esc(id) +
      '">' +
      '<div class="handout-card-titles">' +
      '<h2 class="handout-card-title">' +
      esc(title) +
      "</h2>" +
      '<p class="handout-card-sub">' +
      esc(sub) +
      "</p>" +
      "</div>" +
      '<span class="handout-collapse-tools">' +
      printBtn(id) +
      '<span class="handout-collapse-chevron" aria-hidden="true">' +
      CHEVRON_ICO +
      "</span>" +
      "</span>" +
      "</header>" +
      '<div class="handout-collapse-body" id="collapse-body-' +
      esc(id) +
      '" hidden>' +
      '<div class="handout-doc-content" data-collapse-content>' +
      '<p class="handout-help-loading">' +
      esc(loadingLabel) +
      "</p>" +
      "</div>" +
      "</div>" +
      "</section>"
    );
  }

  function helpGuideCard() {
    return collapseCard(
      "helpguide",
      "Help guide",
      "The full rep handbook \u2014 tap to expand or print.",
      "Loading help guide\u2026"
    );
  }

  function callScriptsCard() {
    return collapseCard(
      "callscripts",
      "Call scripts",
      "Every phone script and text/email template \u2014 tap to expand or print.",
      "Loading call scripts\u2026"
    );
  }

  function loadHelpContent(target) {
    return fetch("help.html", { cache: "no-cache" })
      .then((res) => res.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const content = doc.querySelector(".legal-plain-text");
        if (!content) throw new Error("missing");
        target.innerHTML = content.innerHTML;
      })
      .catch(() => {
        target.innerHTML =
          '<p>Could not load the help guide. <a href="help.html" target="_blank" rel="noopener">Open the full help page</a>.</p>';
        throw new Error("failed");
      });
  }

  function loadScriptsContent(target) {
    const renderAcc = (acc) => {
      const q = acc.querySelector(".acc-q");
      const title = q ? q.textContent.replace(/[\u25B2\u25BC\u25B6▼▲]/g, "").trim() : "";
      let s = '<div class="handout-script">';
      if (title) s += '<h3 class="handout-script-title">' + esc(title) + "</h3>";
      acc.querySelectorAll(".script-block").forEach((block) => {
        const label = block.querySelector(".script-label");
        const prompt = block.querySelector(".script-prompt");
        const body = block.querySelector(".script-body");
        if (label)
          s += '<p class="handout-script-label">' + esc(label.textContent.trim()) + "</p>";
        if (prompt) s += '<p class="handout-script-line">' + prompt.innerHTML + "</p>";
        if (body) s += '<p class="handout-script-line">' + body.innerHTML + "</p>";
      });
      s += "</div>";
      return s;
    };

    return fetch("scripts.html", { cache: "no-cache" })
      .then((res) => res.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        let out = "";
        const phone = doc.querySelectorAll("#scripts-editor .acc");
        if (phone.length) {
          out += "<h2>Phone scripts</h2>";
          phone.forEach((a) => (out += renderAcc(a)));
        }
        const outreach = doc.querySelectorAll("#outreach-editor .acc");
        if (outreach.length) {
          out += "<h2>Text &amp; email templates</h2>";
          outreach.forEach((a) => (out += renderAcc(a)));
        }
        if (!out) throw new Error("empty");
        target.innerHTML = out;
      })
      .catch(() => {
        target.innerHTML =
          '<p>Could not load the call scripts. <a href="scripts.html" target="_blank" rel="noopener">Open the Call Scripts page</a>.</p>';
        throw new Error("failed");
      });
  }

  const COLLAPSE_LOADERS = {
    helpguide: loadHelpContent,
    callscripts: loadScriptsContent,
  };
  const collapseLoaded = {};

  function ensureCollapseLoaded(card) {
    const key = card && card.dataset.handout;
    const loader = key && COLLAPSE_LOADERS[key];
    const target = card && card.querySelector("[data-collapse-content]");
    if (!loader || !target || collapseLoaded[key]) return Promise.resolve();
    return loader(target)
      .then(() => {
        collapseLoaded[key] = true;
      })
      .catch(() => {});
  }

  function toggleCollapse(headerEl) {
    const card = headerEl.closest(".handout-card");
    const body = card && card.querySelector(".handout-collapse-body");
    if (!body) return;
    const willOpen = body.hidden;
    if (willOpen) ensureCollapseLoaded(card);
    body.hidden = !willOpen;
    headerEl.setAttribute("aria-expanded", willOpen ? "true" : "false");
    card.classList.toggle("is-open", willOpen);
  }

  function prepCollapseForPrint(card) {
    if (!card) return Promise.resolve();
    const body = card.querySelector(".handout-collapse-body");
    return ensureCollapseLoaded(card).then(() => {
      if (body) body.hidden = false;
      card.classList.add("is-open");
      const head = card.querySelector("[data-collapse-toggle]");
      if (head) head.setAttribute("aria-expanded", "true");
    });
  }

  function prepAllCollapseForPrint() {
    const cards = Array.from(document.querySelectorAll(".handout-collapse"));
    return Promise.all(cards.map((c) => prepCollapseForPrint(c)));
  }

  function printOne(targetCard) {
    document.body.classList.add("handout-printing");
    if (targetCard) {
      document.body.classList.add("handout-print-single");
      targetCard.classList.add("is-print-target");
    }
    const cleanup = () => {
      document.body.classList.remove("handout-printing", "handout-print-single");
      document
        .querySelectorAll(".handout-card.is-print-target")
        .forEach((c) => c.classList.remove("is-print-target"));
      global.removeEventListener("afterprint", cleanup);
    };
    global.addEventListener("afterprint", cleanup);
    global.setTimeout(() => global.print(), 30);
  }

  function bind(root) {
    root.addEventListener("click", (e) => {
      const printBtnEl = e.target.closest("[data-print-handout]");
      if (printBtnEl) {
        const card = printBtnEl.closest(".handout-card");
        if (card && card.classList.contains("handout-collapse")) {
          prepCollapseForPrint(card).then(() => printOne(card));
        } else {
          printOne(card);
        }
        return;
      }
      const toggle = e.target.closest("[data-collapse-toggle]");
      if (toggle) {
        toggleCollapse(toggle);
        return;
      }
      if (e.target.closest("#handouts-print-all")) {
        prepAllCollapseForPrint().then(() => printOne(null));
      }
    });

    root.addEventListener("keydown", (e) => {
      const toggle = e.target.closest("[data-collapse-toggle]");
      if (toggle && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        toggleCollapse(toggle);
      }
    });
  }

  function render() {
    const root = document.getElementById("handouts-root");
    if (!root) return;

    root.innerHTML =
      '<div class="handout-toolbar">' +
      '<p class="handout-toolbar-note">Open or print these references for quick use on calls.</p>' +
      '<button type="button" class="btn secondary" id="handouts-print-all">' +
      PRINTER_ICO +
      "<span>Print all</span></button>" +
      "</div>" +
      '<div class="handout-grid">' +
      workflowCard() +
      qualificationCard() +
      callResponseCard() +
      objectionCard() +
      packagePickerCard() +
      pricingCard() +
      commissionCard() +
      dosDontsCard() +
      callLogCard() +
      contactCard() +
      callScriptsCard() +
      helpGuideCard() +
      "</div>";

    bind(root);
    global.SiteIcons?.initIcons?.(root);
  }

  function start() {
    if (document.body.dataset.page !== "handouts") return;
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(window);
