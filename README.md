# Gia Đình Số (Digital Family)

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase + Gemini/GPT-4o + PayOS (VietQR).
Languages: vi, zh, en, es. Themes: elder, adult, and three youth themes.

## 1. Supabase
1. Create a project. In **SQL Editor**, run `supabase/schema.sql` (new project) or `supabase/migration_v3.sql` (existing project). See HUONG_DAN.md.
2. Copy the project URL, anon key and **service_role** key.

## 2. Environment
Copy `.env.example` to `.env.local` and fill it in. On Vercel add the same names under
**Project > Settings > Environment Variables** (Production, Preview, Development):

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser (realtime only) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only. Never prefix with `NEXT_PUBLIC_` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` or `OPENAI_API_KEY` | AI decoder and game hints |
| `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` | payments |
| `NEXT_PUBLIC_APP_URL` | optional: custom domain. Empty = the Vercel URL is detected automatically |
| `NEXT_PUBLIC_PLAN_MONTHLY_VND`, `NEXT_PUBLIC_PLAN_YEARLY_VND` | plan prices (39,000 / 390,000) |

## 3. Seed the dictionary (121 words)
```bash
npm install
npm run seed:genz        # safe to re-run; existing words are skipped
```
Add new words to `src/data/genz.json` and run it again.

## 4. Run
```bash
npm run dev
```

## 5. PayOS webhook
In the PayOS dashboard set the webhook URL to `https://YOUR-DOMAIN/api/payos/webhook`.
The handler verifies the HMAC signature, marks the payment as paid once, sets
`is_premium`, `plan_type` and `premium_expires_at` (renewals add time on top of the
current expiry) and broadcasts to open browsers so the paywall lifts without a reload.

## 6. Deploy
Push to GitHub, import the repo in Vercel (framework: Next.js, `vercel.json` is included), add the
environment variables, deploy.

## How the pieces fit
- `families.usage_count` is spent through the SQL function `consume_usage` (atomic). Free families get 5
  operations (story saves, AI decoder, AI hints). The 6th returns HTTP 402 and the client opens the paywall.
  If an AI call fails, the use is refunded.
- All family data goes through API routes with the service role, checked by family code. The anon key
  cannot read family tables (RLS has no policies for them). Realtime uses broadcast channels `family:<code>`.
- Payment memo is `FAMILY_<CODE>_<PLAN>` (PayOS limit is 25 characters).

## Troubleshooting: "Có lỗi xảy ra. Vui lòng thử lại."
1. Open `/api/health` (for example `https://YOUR-DOMAIN/api/health` or `http://localhost:3000/api/health`).
   It lists every missing environment variable and every missing table, with the fix next to it.
2. `npm run dev` reads **`.env.local`** only, not the variables you set in Vercel. Copy `.env.local.example`
   to `.env.local` and fill it in (or run `npx vercel env pull .env.local`), then restart `npm run dev`.
3. On Vercel, `NEXT_PUBLIC_*` values are baked in at build time. After adding or changing any variable,
   open Deployments and press **Redeploy**.
4. Tables missing, or an older `families` table with other columns: run `supabase/schema.sql` again.
   It is safe to re-run and upgrades older tables.

## Reminders and safety tab (new)
Run `supabase/add_reminders.sql` once in the Supabase SQL Editor (it is also at the end of `schema.sql`).
Reminders ring only while the page is open (sound, big on-screen alert, browser notification if allowed,
read aloud for grandparents). Anyone can set a reminder for any member or for the whole family.
Open `/api/health` after deploying: it now tests creating a family, a member, a story, a reminder
and the free-use counter, and tells you which one fails.
