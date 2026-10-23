# Putting MedTrack online

Right now everything runs on your laptop. For the app to work on **anyone's phone, anywhere**, three
things go on the internet:

| Part | Where | Cost |
|---|---|---|
| Database | MongoDB Atlas, Mumbai | Free (M0) |
| API (the "kitchen") | Fly.io, Mumbai | About $3–5 a month — needs a card |
| Website | Vercel | Free (Hobby) |
| Phone app | Built by Expo (EAS), installed as an APK or from Play Store | Free tier is enough to start |

Mumbai for both the database and the API keeps health data in India and keeps the app fast for
Indian users.

You need accounts on MongoDB Atlas, Fly.io, Vercel and Expo. Creating them and entering payment
details is something only you can do.

---

## 1. Database — MongoDB Atlas

1. Sign up at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → choose **M0 (free)** → provider **AWS** → region **Mumbai (ap-south-1)**.
3. **Database Access** → add a user with a long random password. Note it down.
4. **Network Access** → add `0.0.0.0/0`. (Fly's outgoing addresses change; the database is still
   protected by the user and password. Tighten this later with Fly's static egress if you want.)
5. **Connect → Drivers** → copy the connection string. It looks like:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/medtrack?retryWrites=true&w=majority
   ```

   Make sure `/medtrack` (the database name) is in it.

---

## 2. API — Fly.io

Install the Fly command-line tool and sign in:

```bash
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

```bash
fly auth login
```

From the **repository root**, create the app without deploying yet. Pick a name — it becomes
`https://<name>.fly.dev`:

```bash
fly launch --no-deploy --config apps/api/fly.toml --name medtrack-api --region bom
```

If you choose a different name, change `app =` in `apps/api/fly.toml` and the two
`MEDTRACK_API_URL` values in `apps/mobile/eas.json` to match.

Generate two different secrets (run this twice and keep both outputs):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set the secrets. Replace each value; the website address comes from step 3, so you can set it
afterwards with the same command:

```bash
fly secrets set --config apps/api/fly.toml MONGODB_URI="mongodb+srv://..." JWT_ACCESS_SECRET="first-secret" JWT_REFRESH_SECRET="second-secret" CORS_ORIGINS="https://your-site.vercel.app" WEB_APP_URL="https://your-site.vercel.app" API_PUBLIC_URL="https://medtrack-api.fly.dev"
```

Email is needed for password resets and caregiver alerts. A free Brevo account
(<https://www.brevo.com>, 300 emails a day) or a Gmail app password both work:

```bash
fly secrets set --config apps/api/fly.toml SMTP_HOST="smtp-relay.brevo.com" SMTP_PORT="587" SMTP_USER="..." SMTP_PASSWORD="..." EMAIL_FROM_ADDRESS="no-reply@yourdomain.com"
```

Deploy:

```bash
fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

Check it is alive — it should say `"database":"connected"`:

```bash
curl https://medtrack-api.fly.dev/api/health
```

**Keep it to one machine.** The reminder scheduler runs inside the API, so two machines would send
every caregiver alert twice. `fly.toml` already sets one always-on machine. If you ever scale out,
set `SCHEDULER_ENABLED=false` on all but one.

---

## 3. Website — Vercel

1. Push this repository to GitHub.
2. At <https://vercel.com/new>, import it.
3. **Root Directory**: `apps/web`. Leave the build settings alone — `apps/web/vercel.json` sets them.
4. **Environment Variables**: add `VITE_API_URL` = `https://medtrack-api.fly.dev/api`.
5. Deploy. Note the address it gives you, e.g. `https://medtrack.vercel.app`.
6. Go back to step 2 and set `CORS_ORIGINS` and `WEB_APP_URL` to that address. The API refuses
   requests from websites it does not know, so the site will not work until this matches.

---

## 4. Phone app — Expo EAS

Install the Expo build tool and sign in:

```bash
npm install -g eas-cli
```

```bash
eas login
```

Link the project (run inside `apps/mobile`; it adds a project id to `app.json`):

```bash
cd apps/mobile && eas init
```

Build an installable Android app (APK) that points at your live API:

```bash
cd apps/mobile && eas build --platform android --profile preview
```

When it finishes, Expo gives you a link and a QR code. **Anyone can open that link on an Android
phone and install the app** — this is how you test with real people before the Play Store.

When ready for the Play Store, build an app bundle and submit it:

```bash
cd apps/mobile && eas build --platform android --profile production
```

```bash
cd apps/mobile && eas submit --platform android --profile production
```

Publishing on Google Play needs a one-time $25 developer account, the Data Safety form, and a
public URL for your Privacy Policy and account deletion — the website's `/privacy` page and
Settings → Delete my account already cover the last two.

---

## 5. Before real patients use it

These are not optional for a medical app:

- **Test reminders on real phones**: one each of Xiaomi/Redmi, Vivo, OPPO/realme and Samsung, with
  the APK from step 4. Lock the phone, wait for a dose time, and check it rings on time. Open
  Settings → *Reminders on this phone* — it measures how late reminders actually arrive.
- **The native reminder module has never been compiled** (there was no Android SDK where it was
  written). The first `eas build` is its first compile. If it fails, the build log will point at
  `modules/medtrack-alarms`.
- **Fill in the legal placeholders** (`[OPERATOR NAME]`, `[REGISTERED ADDRESS]`,
  `[GRIEVANCE OFFICER]`) in `apps/web/src/pages/legal/` and have a lawyer review them.
- **Backups**: Atlas M0 has no automatic backups. Move to a paid tier, or schedule `mongodump`,
  before storing anyone's real history.
