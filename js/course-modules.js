/**
 * Course · 6 modules. Chapters open in the side panel; setup-accounts, preferences, and everyday-tasks use split layouts.
 * Videos: SITE_CONFIG.courseModuleVideos { introduction, business, setup-accounts, preferences, dashboard, everyday-tasks }
 * FAQ lives at faq.html under Help.
 */
(function (global) {
  const MODULES = [
    {
      id: "introduction",
      num: 1,
      title: "Start Here",
      summary:
        "You're hired on the official Website Agency Sales Team. Watch the video, use the chapters below, then move to the next module.",
      duration: "~3 min",
      progressKey: "module_introduction",
      alsoProgress: ["module_welcome", "module_start", "module_progress"],
      chapters: [
        {
          id: "welcome",
          label: "Welcome",
          title: "Welcome",
          transcript: true,
          body: [
            "Welcome to the Sales Team!",
            "This training will guide you through everything you need to know, from using the platform to closing your first deal. Please take your time, follow each step, and avoid skipping lessons to get the most out of the training.",
          ],
        },
        {
          id: "platform-overview",
          label: "Platform Overview",
          title: "Platform Overview",
          transcript: true,
          body: [
            "This platform was designed to be as convenient and interactive as possible. Below each video, you'll find {{Welcome}}, {{Platform Overview}}, and {{Recommendations}} that open a summary of each section, allowing you to quickly review important information without rewatching the entire video.",
            "You can use {{btn-prev}} and {{btn-next}} to navigate between chapters and {{btn-exit}} to leave chapter view at any time.",
            "You'll also see the current chapter, summary, and duration displayed directly within the video. This allows you to follow along by reading the key points while watching, making it easier to stay on track and review information whenever needed.",
          ],
        },
        {
          id: "recommendations",
          label: "Recommendations",
          title: "Recommendations",
          transcript: true,
          body: [
            "For the best experience, I recommend using a computer while going through this platform, although all features will still work on other devices.",
            "When you're ready, click the black \"Next\" button below to continue to the next video. See you there!",
          ],
        },
      ],
    },
    {
      id: "business",
      num: 2,
      title: "The Business",
      summary:
        "The problem we solve, what we sell, your role as a cold caller, how deals flow, pay, expectations, and team policy.",
      duration: "~7 min",
      progressKey: "module_business",
      alsoProgress: [
        "module_what_we_do",
        "module_who_we_help",
        "module_how_we_operate",
        "module_job",
        "module_offer",
        "module_team",
        "module_pay",
        "video",
        "earnings",
      ],
      chapters: [
        {
          id: "who-we-are",
          label: "Who are we",
          title: "Who are we",
          transcript: true,
          body: [
            "I'm Delexo. I build and sell websites to local businesses.",
            "It is 2026. A lot of plumbers, salons, restaurants, house cleaners, chiropractors, and contractors still have no real website · and they are losing clients because of it.",
            "Without a site they do not look professional. Customers cannot find them online, see what they offer, book, or contact them easily.",
            "A website is the best first impression for a business. That is the problem we solve.",
            "We go after owner-run local businesses with no site or a weak one. Skip strong sites, big chains, and anyone who cannot say yes.",
          ],
        },
        {
          id: "what-we-sell",
          label: "What do we sell",
          title: "What do we sell",
          transcript: true,
          body: [
            "I build them a free demo website first so they can see what they are missing. If they want to go live, you quote one of our tiers on the call.",
            "Four tiers by business size: $500 upfront plus $5 a month, $700 plus $20 a month, $1,000 plus $10 a month, or $1,500 upfront plus $10 a month. You pick the price that fits the business · they do not choose the package themselves.",
            "Most agencies charge thousands to six figures for a high-end site. Our rates are much lower, which makes this an easy yes for owners.",
            "Direct Link means demo plus pay-by-text. Booking means demo plus a meeting. Ask which delivery they want · do not pick that for them.",
          ],
        },
        {
          id: "your-role",
          label: "Your role",
          title: "Your role",
          transcript: true,
          body: [
            "You are a cold caller · the first point of contact.",
            "Your job is to call local businesses that already do not have a website, get them interested in the free demo, quote the right tier for their size, and pass qualified leads to us.",
            "You are not a web designer, developer, or account manager. You focus on the conversation.",
            "We handle the build, bookings, client texts, payment, delivery, and everything after you hand off a real lead.",
            "I cannot personally handle every lead at once. That is why the sales team exists.",
          ],
        },
        {
          id: "how-it-works",
          label: "How it works",
          title: "How it works",
          transcript: true,
          body: [
            "Pick a business, call them, and offer the free website demo.",
            "If they are interested, collect the details we need · including the tier you quoted · and send the lead to us. You do not send the demo link yourself.",
            "After you forward a qualified lead, we build and deploy the demo, text the client their site, book meetings when needed, handle revisions, and confirm payment when the deal closes.",
            "Then you are done with that lead · move on to the next call. If they said no, thank them and keep dialing.",
            "No client payment means no commission for you.",
          ],
        },
        {
          id: "how-you-get-paid",
          label: "How you get paid",
          title: "How you get paid",
          transcript: true,
          body: [
            "You earn 40% of the upfront payment when the client pays · not the monthly fee. Monthly covers hosting and subscriptions on our side.",
            "$1,500 sale pays you $600. $1,000 pays $400. $700 pays $280. $500 pays $200.",
            "You are not paid when you forward a lead or hear maybe on the phone. You are paid after the client pays upfront. I will notify you when a deal closes.",
          ],
        },
        {
          id: "what-to-expect",
          label: "What to expect",
          title: "What to expect",
          transcript: true,
          body: [
            "Enter at your own risk. There is no hourly pay · you get paid when a sale closes, not for time on the phone.",
            "That also means you can put in many hours calling and still not close a deal yet. No boss is docking your check, but your time is on the line until someone pays.",
            "The other side is real too: you might spend five hours on the phone, close one sale, and that commission can more than pay for the time you put in.",
            "On the upside, there is no penalty, quota, or money lost if you have zero closes so far. You are not buying inventory or paying us to work here.",
            "Cold calling is a real skill. Beginners often dial for a long time before the first commission. Rejection is normal · it does not mean you are failing.",
            "Making your first call is already a big step. Most people never try because they are scared.",
            "Every call makes you better. If you are new, do not quit too early · but go in with your eyes open about how pay works.",
          ],
        },
        {
          id: "policies",
          label: "Policies",
          title: "Policies",
          transcript: true,
          body: [
            "Team policy: every deal you personally close pays you the full 40% commission. No team fees, splits, hidden cuts, or deductions from your own sale.",
            "If you closed it, the 40% is yours.",
            "Owner policy: on deals I close myself, I may split profit evenly among active sales teammates · reps who are consistently calling and participating.",
            "That split rewards effort and fairness. It only applies to deals I close, not yours.",
          ],
        },
      ],
    },
    {
      id: "setup-accounts",
      num: 3,
      title: "Setup Accounts",
      summary:
        "Watch the walkthrough, then complete the setup survey on the right. Set up payout first; Telegram is optional.",
      duration: "~3 min",
      progressKey: "module_setup_accounts",
      alsoProgress: ["module_setup"],
      progressKeys: ["surveyComplete"],
      embedSurvey: true,
    },
    {
      id: "preferences",
      num: 4,
      title: "Preferences",
      summary:
        "Choose your theme, set your nickname, and add a profile photo so the dashboard feels like yours.",
      duration: "~3 min",
      progressKey: "module_preferences",
      progressKeys: ["preferencesComplete"],
      alsoProgress: ["preferences"],
      embedPreferencesSurvey: true,
    },
    {
      id: "dashboard",
      num: 5,
      title: "Platform Tour",
      summary:
        "Walkthrough of every sidebar channel · Overview, Daily tools, and Help · so you know where to go and what to do.",
      duration: "~12 min",
      progressKey: "module_dashboard",
      alsoProgress: [
        "workflow",
        "module_leads",
        "module_calling",
        "module_resources",
        "module_lead_format",
        "module_outreach",
        "leads",
        "script",
        "template",
        "outreach",
      ],
      chapters: [
        {
          id: "sidebar-map",
          label: "Sidebar map",
          title: "How the site is organized",
          transcript: true,
          body: [
            "After sign-in, the left sidebar is your map. It groups pages into Overview, Course, Daily tools, and Help. Terms, Privacy, and Help guide sit at the very bottom.",
            "Overview holds the Dashboard · your income goal, sales log, and pending leads. Course is your six training modules. Daily tools are what you use on every call: Lead Finder, Lead Builder, Call Scripts, and Telegram.",
            "Help holds About us, Settings, FAQ, Feedback, Bug Bounty, and All links · for people, preferences, quick answers, and reporting issues. The next chapters walk through each channel in sidebar order.",
          ],
        },
        {
          id: "dashboard-home",
          label: "Dashboard",
          title: "Dashboard",
          transcript: true,
          body: [
            "The Dashboard is your income command center. Set a monthly goal (default $2,000), watch the progress ring fill as you log sales, and review commission earned and sale count.",
            "Click Log a sale when the owner confirms a client paid upfront · enter the sale amount and business name. Closed deals appear in your sales list below. The tracker is for motivation; official commission still follows owner confirmation and client payment.",
            "Open the Pending businesses panel on the Dashboard to see leads you marked pending in Lead Finder. Call, reopen Lead Builder, complete, cancel, or mark not interested · this is your short list of businesses you are actively working.",
          ],
        },
        {
          id: "lead-finder",
          label: "Lead Finder",
          title: "Lead Finder",
          transcript: true,
          body: [
            "Lead Finder lists local businesses from the team database. Default view is Active · leads nobody has removed or finished. Use the list dropdown for Quick Save, Completed, Not interested, or Removed.",
            "Filter by Website · No website is the default target market. Filter by Google review count when you want smaller businesses first. Category chips prioritize certain business types at the top. Click Refresh if counts look stale.",
            "Each card shows name, category, phone, address, hours, maps link, and actions. Quick Save bookmarks a lead. Build Lead marks it pending for you, adds it to Pending businesses on the Dashboard, prefills Lead Builder, and opens the builder · your main handoff when someone is interested.",
          ],
        },
        {
          id: "lead-builder",
          label: "Lead Builder",
          title: "Lead Builder",
          transcript: true,
          body: [
            "Lead Builder is the form you fill when an owner wants to move forward. Open it from Build Lead on a card or from the pending panel on the Dashboard.",
            "Fields include business name, phone, Google Maps URL, price tier, delivery type (Direct Link vs Booking), and notes. Many fields auto-fill when you use Build Lead from Lead Finder.",
            "When every field is complete, click Send lead. Your submission is saved on the website automatically · no Telegram paste needed. Double-check tier, phone, and spelling before sending; wrong details waste build time.",
          ],
        },
        {
          id: "call-scripts",
          label: "Call Scripts",
          title: "Call Scripts",
          transcript: true,
          body: [
            "Call Scripts lives under Daily tools. The top of the page is for phone scripts · openers, objection handlers, and closing language. Pick a script before you dial and read or adapt it naturally.",
            "Scroll down on the same page for text and email templates · voicemails, cold texts, follow-ups, and email outreach. One sidebar channel covers all outreach wording.",
            "Edits save automatically to your rep account when cloud sync is on. Customize tone to your voice but keep claims accurate · do not promise features or prices you are not authorized to offer.",
          ],
        },
        {
          id: "telegram",
          label: "Telegram",
          title: "Telegram",
          transcript: true,
          body: [
            "Telegram is the live team chat under Daily tools. Click Telegram in the sidebar · you will get a confirmation before leaving the site because it opens an external chat.",
            "Join the Website Agency business chat if you want team updates · it is optional. Lead handoffs go through Lead Builder's Send lead button on the website, not by pasting leads in chat.",
            "Use Telegram for owner questions, deal updates, and payout coordination · not for harassing businesses or sharing lead exports. Payout-related group links may also appear in Settings and the setup survey; follow the owner's instructions.",
          ],
        },
        {
          id: "about-us",
          label: "About Us",
          title: "About Us",
          transcript: true,
          body: [
            "About us is your one stop for the owner and the sales team. At the top you'll find Delexo · contact him for technical issues, strategy questions, or concerns.",
            "Scroll down to Contributors to see who's on the team and whether they're online. Use this page when you need a person, not a FAQ answer.",
          ],
        },
        {
          id: "settings",
          label: "Settings",
          title: "Settings",
          transcript: true,
          body: [
            "Settings holds your profile name, photo, payout method (Cash App, Venmo, PayPal, or Zelle), appearance (theme, accent, UI scale), workspace preferences, and Lead Finder defaults.",
            "Keep payout details current · incorrect info delays commission. Sign out when you are done for the day, especially on a shared computer.",
          ],
        },
        {
          id: "faq",
          label: "FAQ",
          title: "FAQ",
          transcript: true,
          body: [
            "FAQ is searchable Q&A on pricing tiers, how you get paid (40% of upfront when the client pays), Telegram, daily workflow, and common objections.",
            "Read FAQ before asking the same question in Telegram. Team Q&A at the top covers questions other reps have asked · check How you get paid for commission examples.",
          ],
        },
        {
          id: "feedback",
          label: "Feedback",
          title: "Feedback",
          transcript: true,
          body: [
            "Feedback is for ideas to improve the platform, workflow, and features · not for broken pages or errors.",
            "Use Bug Bounty when something does not work as expected. Use Feedback when you have a suggestion for how we could work better.",
          ],
        },
        {
          id: "bug-bounty",
          label: "Bug Bounty",
          title: "Bug Bounty",
          transcript: true,
          body: [
            "Bug Bounty is where you report broken software. Describe what page you were on, what you clicked, what you expected, and what happened instead. Screenshots help.",
            "Valid reports may earn a payout per the program rules on that page. Persistent Lead Finder errors, pages that will not load, or scripts not saving are examples of bug reports · not product ideas.",
          ],
        },
        {
          id: "all-links",
          label: "All Links",
          title: "All Links",
          transcript: true,
          body: [
            "All links is a searchable hub of every internal page, course module, and team URL · grouped by Sales tools, Course, Help, Team contact, and Legal.",
            "Use it when you need a URL you cannot find in the sidebar. Filter by internal, external, or course links, or search by name.",
          ],
        },
      ],
    },
    {
      id: "everyday-tasks",
      num: 6,
      title: "Sales Tasks",
      summary:
        "What you do every workday to close deals. Watch the demo, then follow the five steps on the right each day.",
      duration: "~5 min",
      progressKey: "module_everyday_tasks",
      alsoProgress: ["everyday_tasks", "daily", "workflow"],
      embedEverydayTasks: true,
    },
  ];

  function cfg() {
    return global.SITE_CONFIG || {};
  }

  function list() {
    return MODULES.slice();
  }

  function get(id) {
    const aliases = {
      welcome: "introduction",
      start: "introduction",
      progress: "introduction",
      "the-business": "business",
      "what-we-do": "business",
      "who-we-help": "business",
      "how-we-operate": "business",
      job: "business",
      offer: "business",
      team: "business",
      pay: "business",
      setup: "setup-accounts",
      prefs: "preferences",
      settings: "preferences",
      tour: "dashboard",
      daily: "everyday-tasks",
      everyday: "everyday-tasks",
      workflow: "everyday-tasks",
      resources: "dashboard",
      leads: "dashboard",
      calling: "dashboard",
      "lead-format": "dashboard",
      outreach: "dashboard",
    };
    const resolved = aliases[id] || id;
    return MODULES.find((m) => m.id === resolved) || null;
  }

  function firstModule() {
    return MODULES[0] || null;
  }

  function href(mod) {
    if (!mod) {
      const first = firstModule();
      return first ? href(first) : "course-module.html?m=introduction";
    }
    if (mod.href) return mod.href;
    return "course-module.html?m=" + encodeURIComponent(mod.id);
  }

  function videoUrl(mod) {
    if (!mod || mod.type === "interactive") return "";
    const overrides = cfg().courseModuleVideos || {};
    if (overrides[mod.id]) return String(overrides[mod.id]).trim();
    if (mod.videoUrl) return String(mod.videoUrl).trim();
    return String(cfg().onboardingVideoUrl || "").trim();
  }

  function embedUrl(url) {
    if (!url) return "";
    if (url.includes("youtube.com/watch")) {
      try {
        const id = new URL(url).searchParams.get("v");
        if (id) return "https://www.youtube.com/embed/" + id;
      } catch (e) {
        /* ignore */
      }
    }
    if (url.includes("youtu.be/")) {
      return "https://www.youtube.com/embed/" + url.split("youtu.be/")[1].split("?")[0];
    }
    return url;
  }

  function chapterById(mod, chapterId) {
    if (!mod?.chapters) return null;
    let resolved = chapterId;
    if (resolved === "additional-info") resolved = "recommendations";
    if (resolved === "tips-tricks") resolved = "platform-overview";
    return mod.chapters.find((c) => c.id === resolved) || null;
  }

  function isComplete(mod, progress) {
    if (!mod || !progress) return false;
    if (mod.embedSurvey) {
      if (!mod.progressKeys?.length) return !!progress[mod.progressKey];
      return mod.progressKeys.every((k) => progress[k]);
    }
    if (mod.progressKeys?.length) return mod.progressKeys.every((k) => progress[k]);
    if (mod.progressKey) return !!progress[mod.progressKey];
    return false;
  }

  /** Drop stale module flags when survey prerequisites were never finished. */
  function reconcileProgress(progress) {
    if (!progress || typeof progress !== "object") return {};
    const next = { ...progress };
    MODULES.forEach((mod) => {
      if (!mod.embedSurvey || !mod.progressKey || !next[mod.progressKey]) return;
      const ready = mod.progressKeys?.length
        ? mod.progressKeys.every((k) => next[k])
        : true;
      if (ready) return;
      delete next[mod.progressKey];
      if (mod.alsoProgress) mod.alsoProgress.forEach((k) => delete next[k]);
    });
    return next;
  }

  function markComplete(mod, progress) {
    if (!mod) return progress;
    const next = { ...progress };
    if (mod.progressKeys?.length) {
      const ready = mod.progressKeys.every((k) => next[k]);
      if (!ready) return next;
    }
    if (mod.progressKey) next[mod.progressKey] = true;
    if (mod.alsoProgress) mod.alsoProgress.forEach((k) => (next[k] = true));
    return next;
  }

  function completedCount(progress) {
    return MODULES.filter((m) => isComplete(m, progress)).length;
  }

  function nextModule(id) {
    const idx = MODULES.findIndex((m) => m.id === id);
    return idx >= 0 && idx < MODULES.length - 1 ? MODULES[idx + 1] : null;
  }

  function prevModule(id) {
    const idx = MODULES.findIndex((m) => m.id === id);
    return idx > 0 ? MODULES[idx - 1] : null;
  }

  function firstIncomplete(progress) {
    return MODULES.find((m) => !isComplete(m, progress)) || null;
  }

  function allComplete(progress) {
    return MODULES.length > 0 && MODULES.every((m) => isComplete(m, progress));
  }

  function loginLandingUrl(progress) {
    if (allComplete(progress)) return "dashboard.html";
    const inc = firstIncomplete(progress);
    return inc ? href(inc) : "course-module.html?m=introduction";
  }

  global.CourseModules = {
    list,
    get,
    firstModule,
    href,
    videoUrl,
    embedUrl,
    chapterById,
    isComplete,
    reconcileProgress,
    markComplete,
    completedCount,
    nextModule,
    prevModule,
    firstIncomplete,
    allComplete,
    loginLandingUrl,
  };
})(window);
