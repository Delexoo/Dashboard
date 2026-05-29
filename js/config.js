/**
 * Public site config — safe to commit to GitHub.
 * Secrets (Supabase keys, rep PINs) go in js/private-config.js (never committed).
 * See README.md and private-config.example.js.
 */
window.SITE_CONFIG = {
  companyName: "Sales Team Dashboard",
  ownerName: "Delexo",
  ownerHandle: "@delexoo",
  ownerPhotoUrl: "https://github.com/Delexoo/test/blob/main/IMG_7243%20(1).jpg?raw=true",
  ownerBio: "Hi, I’m Delexo. I’m 19, and I’m very ambitious—I push myself to my absolute limits. In 2025, I enrolled in Harvard’s CS50 and Google’s Cybersecurity Certificate. I’m currently pursuing Harvard’s Cybersecurity for Business program.",
  ownerTelegram: "https://t.me/delexoo",
  supportTelegram: "https://t.me/delexoo",
  telegramTeam: "https://t.me/c/3541685239/1",
  telegramTeamName: "Official Telegram Business Chat",
  interestedBusinessesUrl: "https://t.me/c/3541685239/8",
  payoutTelegramUrl: "https://t.me/+U9wsP-sf8GFmNWFh",
  payoutTelegramName: "Website Agency",
  leadsListUrl: "leads.html",
  supabaseUrl: "",
  supabaseAnonKey: "",
  useSupabaseLeads: true,
  useRepSettingsSync: true,
  useBugReports: true,
  useFeedback: true,
  onboardingVideoUrl: "",
  onboardingVideoLabel: "Full course walkthrough (9–14 min)",
  email: "fullprofessionalwebsites@outlook.com",
  phone: "(401) 300-0957",
  packages: [
    { upfront: "$500", monthly: "$5/mo", commission: "$200" },
    { upfront: "$700", monthly: "$20/mo", commission: "$280" },
    { upfront: "$1,000", monthly: "$10/mo", commission: "$400" },
    { upfront: "$1,500", monthly: "$10/mo", commission: "$600" }
  ],
  reps: []
};
