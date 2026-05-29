# Sales Team Dashboard (GitHub Pages)

This folder is the **public** copy of the site — safe to push to GitHub. It contains **no PINs, API keys, or database secrets**.

## What is included

- HTML pages, `css/site.css`, and JavaScript
- `js/config.js` — branding, links, packages (public)
- `js/private-config.example.js` — template only (no real secrets)

## What is NOT included (never commit these)

| File | Why |
|------|-----|
| `js/private-config.js` | Supabase URL/key + rep PINs |
| `users.txt` | Plain-text PINs |
| `data/reps.json` | PINs |
| `*.sql` | Database setup (run in Supabase dashboard only) |
| `import_*.sql` | Lead data dumps |

## Go live on GitHub Pages

### 1. Create the repo

1. Create a new **private** or **public** GitHub repository.
2. Push **only the contents of this `github` folder** as the repo root (not the parent `SalesTeamWebsite` folder).

```powershell
cd "path\to\SalesTeamWebsite\github"
git init
git add .
git commit -m "Initial public site"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 2. Add GitHub Secrets

In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase **publishable** or anon key |
| `SITE_REPS_JSON` | JSON array, e.g. `[{"id":"rep1","name":"Rep One","pin":"1234"}]` |

`SITE_REPS_JSON` must be valid JSON on one line. PINs are injected at deploy time only — they are **not** stored in git history if you never commit `private-config.js`.

### 3. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions**

Push to `main`. The workflow `.github/workflows/deploy.yml` builds `js/private-config.js` from secrets and deploys.

Your site URL will be like: `https://YOUR_USER.github.io/YOUR_REPO/`

## Local testing (before push)

```powershell
cd github
copy js\private-config.example.js js\private-config.js
# Edit js\private-config.js with real Supabase URL, key, and test PINs
python -m http.server 8765
```

Open `http://localhost:8765` — hard refresh after edits.

## Syncing updates from the main project

From the `SalesTeamWebsite` folder (parent of `github/`):

```powershell
node scripts/sync-to-github.js
```

This copies HTML, CSS, and JS into `github/`, injects `private-config.js` + `config-merge.js` on every page, and rebuilds `js/config.js` **without** Supabase keys or PINs. It never copies `users.txt`, `data/`, SQL files, or `js/private-config.js`.

## Security notes

- Supabase **anon/publishable** keys are still visible in the browser after deploy — protect data with Row Level Security in Supabase.
- PINs in `private-config.js` are visible to anyone who can open that file on the live site. Use a **private** repo + trusted hosting, or move to server-side PIN checks for higher security.
- Never commit `private-config.js` or paste real PINs into issues, PRs, or screenshots.
