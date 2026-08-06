# UOR FOE — GPA Ledger

A responsive, dark-blue themed GPA tracker for the Faculty of Engineering, University of Ruhuna.
Covers all 8 semesters — Semesters 1 & 2 are common to everyone, Semesters 3–8 are split by
department (DEIE, DMME, DMENA, DCEE, DCE). Sign-in is Google-only via Supabase Auth, so there's
no password to create or remember.

## Files

| File | Purpose |
|---|---|
| `schema.sql.txt` | Run once in the Supabase SQL editor. Creates every table, RLS policy, trigger, and seeds Semester 1 & 2 modules + empty semester shells for 3–8. |
| `config.js` | Shared Supabase client + grade-point table. **Edit the two constants at the top before anything else will work.** |
| `login.html` / `login.css` | Google sign-in screen. |
| `index.html` / `main.css` / `main.js` | Student dashboard: semester tabs, grade entry, target-GPA planner, profile tab. |
| `admin.html` / `admin.css` / `admin.js` | Admin panel: change admin email, create semesters, add modules, browse students. |
| `analytics.html` / `analytics.css` / `analytics.js` | Admin-only analytics: KPIs, grade distribution, per-department/batch average CGPA, leaderboard. |

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Once it's up, open **SQL Editor → New query**, paste the entire contents of `schema.sql.txt`, and run it.
   This creates all tables, security policies, and seeds the admin email (`adithyawije34@gmail.com`) plus
   the Semester 1 & 2 module list already in your ledger.
3. Open **Project Settings → API** and copy the **Project URL** and **anon public key**.
4. Paste them into `config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";
   ```

## 2. Turn on Google sign-in

1. In Supabase: **Authentication → Providers → Google** → toggle on.
2. You'll need a Google Cloud OAuth Client ID/Secret (Google Cloud Console → APIs & Services →
   Credentials → OAuth client ID → Web application). Set the **Authorized redirect URI** to the
   callback URL Supabase shows you on that same screen (`https://xxxxx.supabase.co/auth/v1/callback`).
3. Paste the Google Client ID + Secret back into the Supabase provider screen and save.
4. In **Authentication → URL Configuration**, add the URL(s) you'll host this app on (e.g.
   `https://your-domain.com` and/or `http://localhost:5500`) to **Redirect URLs**.

This is the "easy login" — one click, no separate password, and a verified email straight from
Google, which the `handle_new_user` trigger uses to auto-create the student's profile row (and to
flag them admin automatically if their email matches `app_settings.admin_email`).

## 3. Run it locally

Because the pages use ES module `<script type="module">` imports, they must be served over
`http://`, not opened directly as `file://`. Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 5500
```

Then visit `login.html`.

## 4. Deploy

Any static host works (Vercel, Netlify, GitHub Pages, Cloudflare Pages…) — just upload all the
files as-is and add that host's URL to Supabase's Redirect URLs list from step 2.4.

## How things fit together

- **Auth guard**: every page except `login.html` calls `supabase.auth.getSession()` on load and
  redirects to `login.html` if there's no session.
- **Admin check**: a Postgres function `is_admin()` compares the signed-in user's JWT email against
  `app_settings.admin_email`. `admin.html` and `analytics.html` call it via `supabase.rpc('is_admin')`
  and bounce non-admins back to the student dashboard.
- **Changeable admin email**: Admin → Settings updates `app_settings.admin_email` directly. The next
  time *any* user's session is checked against `is_admin()`, access follows the new address — no
  redeploy needed.
- **Semesters 1 & 2 by default**: the schema seeds these as `department = null`, so every student sees
  them regardless of department. Semesters 3–8 only appear once the student sets their department on
  the Profile tab (`profiles.department`), which then filters `semesters` client-side.
- **SGPA / CGPA math** (in `config.js`, reused everywhere):
  `SGPA = Σ(credits × grade_point) / Σ(credits)` over graded, GPA-counting modules in that semester;
  `CGPA` is the same formula run across every module in every unlocked semester.
  Grade points: A+/A = 4.0, A- = 3.7, B+ = 3.3, B = 3.0, B- = 2.7, C+ = 2.4, C = 2.0, C- = 1.7, E = 0.0.
  `MC` / `AC` / `WH` are selectable but excluded from GPA math, matching the legend in the source sheet.
- **Target-GPA planner**: shown only above Semester 1 & 2. Given a target, it solves
  `required_avg = (target × total_credits − earned_points) / pending_credits` and reports whether
  it's achievable, and roughly which grade average is needed.
- **Saving**: grade dropdowns update in-memory immediately (so SGPA/CGPA react live); nothing hits
  the database until **Save changes** is pressed, which upserts only the changed rows into `grades`.
- **Row Level Security**: students can only ever read/write their own `profiles`/`grades`/`target_gpa`
  rows; only the admin can write `semesters`/`modules`/`app_settings`. Everyone signed in can read the
  semester/module catalogue.
