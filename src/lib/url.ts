/**
 * One place that answers "what is the public address of this app?".
 * Used for email-login links and PayOS return URLs, so they never point at a dead localhost.
 *
 * Order: NEXT_PUBLIC_APP_URL (unless it is localhost while the page is really live)
 *   -> Vercel production domain -> Vercel deployment URL -> browser origin -> localhost.
 * NOTE: process.env.NEXT_PUBLIC_* must be written literally so Next.js can inline them in the browser bundle.
 */
const isLocal = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(u);

function clean(u?: string | null): string | null {
  const v = (u ?? '').trim();
  if (!v) return null;
  return (/^https?:\/\//i.test(v) ? v : `https://${v}`).replace(/\/+$/, '');
}

/** Public URL of the app. Safe in the browser and on the server (without a request). */
export function getAppUrl(): string {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL);
  const browser = typeof window !== 'undefined' ? window.location.origin : null;
  // A forgotten "http://localhost:3000" in Vercel settings must not win over the real address.
  if (explicit && !(isLocal(explicit) && browser && !isLocal(browser))) return explicit;

  const prod =
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
      ? clean(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ?? clean(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : null;
  return (
    prod ??
    clean(process.env.NEXT_PUBLIC_VERCEL_URL) ??
    clean(process.env.VERCEL_URL) ??
    browser ??
    explicit ??
    'http://localhost:3000'
  );
}

/** Server version: also understands the incoming request as the last resort. */
export function getServerAppUrl(req?: Request): string {
  const explicit = clean(process.env.NEXT_PUBLIC_APP_URL);
  const reqOrigin = req ? new URL(req.url).origin : null;
  if (explicit && !(isLocal(explicit) && reqOrigin && !isLocal(reqOrigin))) return explicit;
  const prod = process.env.VERCEL_ENV === 'production' ? clean(process.env.VERCEL_PROJECT_PRODUCTION_URL) : null;
  return prod ?? clean(process.env.VERCEL_URL) ?? reqOrigin ?? explicit ?? 'http://localhost:3000';
}
