'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { api, post } from '@/lib/api';
import { PLANS, YEARLY_PER_MONTH, YEARLY_SAVE_PERCENT } from '@/lib/plans';
import { useApp } from '@/lib/store';
import { isPremiumActive, type Plan } from '@/lib/types';
import { Button, Modal, cn } from './ui';

interface PayInfo {
  orderCode: number;
  amount: number;
  memo: string;
  qrCode: string;
  checkoutUrl: string;
  accountNumber: string | null;
  accountName: string | null;
}

/** PRO upgrade: pick a plan, PayOS makes a fresh VietQR for exactly that amount, the screen unlocks by itself. */
export default function PaywallModal({ refresh }: { refresh: () => void }) {
  const { t, i18n } = useTranslation();
  const { code, family, paywall, setPaywall } = useApp();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const polls = useRef(0);
  const premium = isPremiumActive(family);
  const money = (n: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

  const close = () => { setPaywall(false); setPay(null); setDone(false); };

  // Payment arrived: show success, then close.
  useEffect(() => {
    if (!paywall || !pay || !premium) return;
    setDone(true);
    const id = setTimeout(close, 3000);
    return () => clearTimeout(id);
  }, [premium, paywall, pay]); // eslint-disable-line react-hooks/exhaustive-deps

  // While a QR is on screen: ask our server every 3 s (and PayOS itself every 4th time) if the money arrived.
  useEffect(() => {
    if (!paywall || !pay || premium) return;
    polls.current = 0;
    const id = setInterval(async () => {
      polls.current += 1;
      try {
        const r = await api<{ status: string }>(`/api/payos/status?code=${code}&orderCode=${pay.orderCode}${polls.current % 4 === 0 ? '&verify=1' : ''}`);
        if (r.status === 'paid') refresh();
        else if (r.status === 'expired' || r.status === 'cancelled') { setPay(null); setErr(t('paywall.expired')); }
      } catch { /* try again on the next tick */ }
    }, 3000);
    return () => clearInterval(id);
  }, [paywall, pay, premium, code, refresh, t]);

  async function start() {
    setBusy(true);
    setErr('');
    try {
      setPay(await post<PayInfo>('/api/payos/create', { code, plan }));
    } catch {
      setErr(t('paywall.error'));
    }
    setBusy(false);
  }

  const features = ['f1', 'f2', 'f3', 'f4'] as const;

  return (
    <Modal open={paywall && !(premium && !pay)} onClose={close} title={t('paywall.title')}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={56} className="text-leaf" />
          <p className="text-xl font-bold">{t('paywall.success')}</p>
        </div>
      ) : !pay ? (
        <div className="flex flex-col gap-4">
          <p>{t('paywall.desc')}</p>
          <ul className="flex flex-col gap-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2"><Check size={20} className="mt-0.5 shrink-0 text-leaf" aria-hidden /> {t(`paywall.${f}`)}</li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('paywall.title')}>
            {(['monthly', 'yearly'] as Plan[]).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={plan === p}
                onClick={() => setPlan(p)}
                className={cn('relative rounded-theme border-2 p-4 text-left transition', plan === p ? 'border-accent bg-bg ring-2 ring-accent' : 'border-border')}
              >
                {p === 'yearly' && (
                  <span className="absolute -top-3 right-3 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-fg">
                    {t('paywall.save', { n: YEARLY_SAVE_PERCENT })}
                  </span>
                )}
                <span className="block text-lg font-bold">{t(`paywall.${p}`)}</span>
                <span className="block text-2xl font-extrabold">{money(PLANS[p].amount)}</span>
                <span className="block text-sm text-muted">
                  {p === 'monthly' ? t('paywall.perMonthly') : t('paywall.perYearly', { price: money(YEARLY_PER_MONTH) })}
                </span>
              </button>
            ))}
          </div>
          <Button onClick={start} disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={18} />} {t('paywall.pay')} · {money(PLANS[plan].amount)}
          </Button>
          {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="font-semibold">{t('paywall.scan')}</p>
          <div className="rounded-theme bg-white p-2">
            <QRCodeSVG value={pay.qrCode} size={224} marginSize={2} />
          </div>
          <dl className="w-full space-y-1 text-left">
            <div className="flex justify-between gap-3"><dt className="text-muted">{t('paywall.amount')}</dt><dd className="font-bold">{money(pay.amount)}</dd></div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t('paywall.memo')}</dt>
              <dd className="flex items-center gap-2 font-mono font-bold">
                {pay.memo}
                <button aria-label={t('common.copy')} onClick={() => navigator.clipboard?.writeText(pay.memo)} className="rounded p-1 hover:bg-bg"><Copy size={16} /></button>
              </dd>
            </div>
            {pay.accountNumber && <div className="flex justify-between gap-3"><dt className="text-muted">{pay.accountName}</dt><dd className="font-mono font-bold">{pay.accountNumber}</dd></div>}
          </dl>
          <p className="flex items-center gap-2 text-muted"><Loader2 className="animate-spin" size={16} /> {t('paywall.waiting')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href={pay.checkoutUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-theme border-2 border-border px-4 font-semibold hover:border-accent">
              <ExternalLink size={16} /> {t('paywall.openCheckout')}
            </a>
            <Button variant="ghost" onClick={() => setPay(null)}>{t('paywall.back')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
