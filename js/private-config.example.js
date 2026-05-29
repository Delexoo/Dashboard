/**
 * COPY to private-config.js for local testing or GitHub Actions deploy.
 * NEVER commit private-config.js — it contains secrets.
 */
window.SITE_PRIVATE = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLISHABLE_OR_ANON_KEY",
  reps: [
    { id: "rep1", name: "Rep One", pin: "0000" },
    { id: "rep2", name: "Rep Two", pin: "0000" },
  ],
};
