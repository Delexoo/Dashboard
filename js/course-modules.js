/**
 * Course — 5 modules. Chapters open in the side panel; setup-accounts and everyday-tasks use split layouts.
 * Videos: SITE_CONFIG.courseModuleVideos { introduction, business, setup-accounts, dashboard, everyday-tasks }
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
            "You're hired!",
            "Welcome to the official Website Agency Sales Team.",
            "Before we get started, I would want you to relax and sit back and make sure you don't skip anything. I will be straightforward with you, I'll walk you through how to use this platform. I'm not here to waste your time, no bs.",
          ],
        },
        {
          id: "tips-tricks",
          label: "Tips & Tricks",
          title: "Tips & Tricks",
          transcript: true,
          body: [
            "This platform is designed to be as convenient and interactive as possible. You'll notice chapters listed right below each video that looks a lot like this. You can actually click on them and you'll open the chapters summary, I built this so you don't have to rewatch the video a million times now you can review at any given moment. You can also use the blue arrow buttons to navigate between different chapters, or if you'd like to exit this mode simply click on the red exit button.",
            "Inside each video, you'll also see the chapters displayed on screen like this along with the duration, so you can follow along by reading the summary while listening to me talk, that's fine too. These are here so you can easily track the current chapter and the summary.",
          ],
        },
        {
          id: "recommendations",
          label: "Recommendations",
          title: "Recommendations",
          transcript: true,
          body: [
            "For the best results, I recommend using a computer when going through this platform, although everything will still work on other devices.",
            "With that being said, click on the black \"Next\" button to see you in the next video!",
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
            "It is 2026. A lot of plumbers, salons, restaurants, house cleaners, chiropractors, and contractors still have no real website — and they are losing clients because of it.",
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
            "Four tiers by business size: $500 upfront plus $5 a month, $700 plus $20 a month, $1,000 plus $10 a month, or $1,500 upfront plus $10 a month. You pick the price that fits the business — they do not choose the package themselves.",
            "Most agencies charge thousands to six figures for a high-end site. Our rates are much lower, which makes this an easy yes for owners.",
            "Direct Link means demo plus pay-by-text. Booking means demo plus a meeting. Ask which delivery they want — do not pick that for them.",
          ],
        },
        {
          id: "your-role",
          label: "Your role",
          title: "Your role",
          transcript: true,
          body: [
            "You are a cold caller — the first point of contact.",
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
            "If they are interested, collect the details we need — including the tier you quoted — and send the lead to us. You do not send the demo link yourself.",
            "After you forward a qualified lead, we build and deploy the demo, text the client their site, book meetings when needed, handle revisions, and confirm payment when the deal closes.",
            "Then you are done with that lead — move on to the next call. If they said no, thank them and keep dialing.",
            "No client payment means no commission for you.",
          ],
        },
        {
          id: "how-you-get-paid",
          label: "How you get paid",
          title: "How you get paid",
          transcript: true,
          body: [
            "You earn 40% of the upfront payment when the client pays — not the monthly fee. Monthly covers hosting and subscriptions on our side.",
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
            "Enter at your own risk. There is no hourly pay — you get paid when a sale closes, not for time on the phone.",
            "That also means you can put in many hours calling and still not close a deal yet. No boss is docking your check, but your time is on the line until someone pays.",
            "The other side is real too: you might spend five hours on the phone, close one sale, and that commission can more than pay for the time you put in.",
            "On the upside, there is no penalty, quota, or money lost if you have zero closes so far. You are not buying inventory or paying us to work here.",
            "Cold calling is a real skill. Beginners often dial for a long time before the first commission. Rejection is normal — it does not mean you are failing.",
            "Making your first call is already a big step. Most people never try because they are scared.",
            "Every call makes you better. If you are new, do not quit too early — but go in with your eyes open about how pay works.",
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
            "Owner policy: on deals I close myself, I may split profit evenly among active sales teammates — reps who are consistently calling and participating.",
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
        "Watch the walkthrough, then complete the setup survey on the right. Add Telegram and payout before you dial.",
      duration: "~3 min",
      progressKey: "module_setup_accounts",
      alsoProgress: ["module_setup"],
      progressKeys: ["telegram", "payout"],
      embedSurvey: true,
    },
    {
      id: "dashboard",
      num: 4,
      title: "Platform Tour",
      summary:
        "Quick tour of each sidebar page — what it’s for and when to open it.",
      duration: "~6 min",
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
        "checklist",
      ],
      chapters: [
        {
          id: "dashboard-home",
          label: "Dashboard",
          title: "Dashboard",
          transcript: true,
          body: [
            "Your home after sign-in — set an income goal and watch commission and sales add up.",
            "When Delexo confirms a close, log it under Log a sale (amount + optional business name) so your tracker stays accurate.",
          ],
        },
        {
          id: "lead-finder",
          label: "Lead Finder",
          title: "Lead Finder",
          transcript: true,
          body: [
            "Your calling list — search, filter, open a card, dial the number.",
            "Filters like No website match our pitch. Complete and Pending are visible to the whole team. Quick Save (heart) and Pin are only for you. Interested leads go to Telegram.",
          ],
        },
        {
          id: "call-scripts",
          label: "Call scripts",
          title: "Call scripts",
          transcript: true,
          body: [
            "Talk tracks for the free demo pitch — open before you dial.",
            "Pick a script; edits save to your account. Use FAQ tier pricing — don't invent numbers. Pushback goes in Lead Builder; escalate via Meet the Owner if needed.",
          ],
        },
        {
          id: "lead-builder",
          label: "Lead Builder",
          title: "Lead Builder",
          transcript: true,
          body: [
            "Only after they said yes on the call.",
            "Direct Link or Booking — name, business, tier, maps link, phone. Copy the message into Interested Businesses on Telegram; price must match what you quoted.",
          ],
        },
        {
          id: "text-email",
          label: "Text & email",
          title: "Text & email",
          transcript: true,
          body: [
            "Short follow-ups when they did not answer — not your main pitch.",
            "No payment or unauthorized promises. Keep dialing Lead Finder; this page is for no-answer only.",
          ],
        },
        {
          id: "setup-checklist",
          label: "Setup checklist",
          title: "Setup checklist",
          transcript: true,
          body: [
            "Onboarding scoreboard: course modules, Telegram, payout, and key tools before your first call.",
            "Check items off as you finish. Mark anything you completed elsewhere (e.g. payout in Settings).",
          ],
        },
        {
          id: "meet-owner",
          label: "Meet the Owner",
          title: "Meet the Owner",
          transcript: true,
          body: [
            "Reach Delexo when FAQ and the course don't cover it — deals, lockouts, unusual calls.",
            "Message from the page or Telegram. PINs are personal; wait out the timer or contact Delexo if locked out.",
          ],
        },
        {
          id: "settings",
          label: "Settings",
          title: "Settings",
          transcript: true,
          body: [
            "Theme, preferences, and payout (Cash App, Venmo, PayPal, Zelle).",
            "Add payout here if you skipped Setup Accounts. Changes save to your rep profile.",
          ],
        },
        {
          id: "faq",
          label: "FAQ",
          title: "FAQ",
          transcript: true,
          body: [
            "Day-to-day rules: where to post leads, Team Telegram, tiers, tough calls.",
            "Read how you get paid before quoting prices. Try FAQ before messaging the owner.",
          ],
        },
        {
          id: "all-links",
          label: "All links",
          title: "All links",
          transcript: true,
          body: [
            "One table of pages, course modules, and team Telegram URLs.",
            "Use when you need Interested Businesses or a course link fast — handy on mobile.",
          ],
        },
        {
          id: "feedback",
          label: "Feedback",
          title: "Feedback",
          transcript: true,
          body: [
            "Ideas to improve the platform — workflow, features, unclear copy.",
            "Not for broken pages (use Bug Bounty). Include the page name; your rep name is attached.",
          ],
        },
        {
          id: "bug-bounty",
          label: "Bug Bounty",
          title: "Bug Bounty",
          transcript: true,
          body: [
            "Broken pages, payout not saving, Lead Finder errors, PIN issues beyond the timer.",
            "What you clicked, expected vs actual; screenshots help. Feedback = ideas; Bug Bounty = defects.",
          ],
        },
      ],
    },
    {
      id: "everyday-tasks",
      num: 5,
      title: "Everyday Tasks",
      summary:
        "What you do every workday to close deals. Watch the demo, then follow the six steps on the right each day.",
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
    const resolved =
      chapterId === "additional-info" ? "recommendations" : chapterId;
    return mod.chapters.find((c) => c.id === resolved) || null;
  }

  function isComplete(mod, progress) {
    if (!mod || !progress) return false;
    if (mod.progressKeys?.length) return mod.progressKeys.every((k) => progress[k]);
    if (mod.progressKey) return !!progress[mod.progressKey];
    return false;
  }

  function markComplete(mod, progress) {
    if (!mod) return progress;
    const next = { ...progress };
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
    markComplete,
    completedCount,
    nextModule,
    prevModule,
    firstIncomplete,
    allComplete,
    loginLandingUrl,
  };
})(window);
