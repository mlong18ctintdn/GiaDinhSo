'use client';
import { useEffect, useState } from 'react';
import { Loader2, LogOut, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api, post } from '@/lib/api';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useApp } from '@/lib/store';
import { getAppUrl } from '@/lib/url';
import { supabaseBrowser } from '@/lib/supabase/client';
import { Button } from '../ui';

interface Mine { family_code: string; created_at: string }

/**
 * Family owner account: sign in by email (a link, no password), claim a family, reopen your families on any device.
 * Other members never need this: they join with the family code.
 */
export default function OwnerAccount({ onOpen, onChanged }: { onOpen?: (code: string) => void; onChanged?: () => void }) {
  const { t } = useTranslation();
  const user = useAuthUser();
  const { code, access } = useApp();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const [mine, setMine] = useState<Mine[]>([]);

  useEffect(() => {
    if (!user) return setMine([]);
    api<{ families: Mine[] }>('/api/me/families').then((r) => setMine(r.families)).catch(() => setMine([]));
  }, [user, access.isOwner]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setErr('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: getAppUrl() } });
    if (error) {
      setErr(`${t('auth.error')} (${error.message})`);
      setState('idle');
    } else setState('sent');
  }

  async function claim() {
    try {
      await post('/api/families/claim', { code });
      onChanged?.();
    } catch {
      setErr(t('auth.error'));
    }
  }

  return (
    <section className="card flex flex-col gap-3" aria-labelledby="auth-title">
      <h2 id="auth-title" className="text-xl font-bold">{t('auth.title')}</h2>
      {!user ? (
        <>
          <p className="text-sm text-muted">{t('auth.hint')}</p>
          {state === 'sent' ? (
            <p role="status" className="font-semibold text-leaf">{t('auth.sent')}</p>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
              <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.email')} aria-label={t('auth.email')} />
              <Button type="submit" disabled={state === 'sending' || !email.trim()}>
                {state === 'sending' ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} {t('auth.send')}
              </Button>
            </form>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{t('auth.loggedAs', { email: user.email })}</p>
            <Button variant="outline" onClick={() => supabaseBrowser().auth.signOut()}>
              <LogOut size={16} /> {t('auth.logout')}
            </Button>
          </div>
          {code && !access.owned && (
            <div className="rounded-theme bg-bg p-3">
              <p className="mb-2 text-sm">{t('family.unclaimed')}</p>
              <Button onClick={claim}>{t('family.claim')}</Button>
            </div>
          )}
          {code && access.isOwner && <p className="font-semibold text-leaf">{t('family.owner')}</p>}
          {mine.length > 0 && onOpen && (
            <div>
              <h3 className="mb-1 font-bold">{t('auth.myFamilies')}</h3>
              <ul className="flex flex-wrap gap-2">
                {mine.map((f) => (
                  <li key={f.family_code}>
                    <Button variant="outline" onClick={() => onOpen(f.family_code)}>
                      <b className="tracking-widest">{f.family_code}</b> · {t('auth.open')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {err && <p role="alert" className="text-sm font-semibold text-red-600">{err}</p>}
    </section>
  );
}
