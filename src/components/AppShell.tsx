'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookText, Dices, Palette, ShieldAlert, TreeDeciduous, Users } from 'lucide-react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { useApp, useMe } from '@/lib/store';
import { isYouth } from '@/lib/themes';
import { useFamilySync } from '@/hooks/useFamilySync';
import Onboarding from './Onboarding';
import TopBanner from './TopBanner';
import LanguageSelect from './LanguageSelect';
import PaywallModal from './PaywallModal';
import ThemePicker from './ThemePicker';

const Loading = () => <div className="card animate-pulse py-16 text-center text-muted" role="status" aria-busy="true">…</div>;
// Each tab is its own chunk: opening the app downloads only what you look at.
const MemoryTree = dynamic(() => import('./tree/MemoryTree'), { ssr: false, loading: Loading });
const GenZDecoder = dynamic(() => import('./decoder/GenZDecoder'), { ssr: false, loading: Loading });
const Games = dynamic(() => import('./games/Games'), { ssr: false, loading: Loading });
const SafetyReminders = dynamic(() => import('./safety/SafetyReminders'), { ssr: false, loading: Loading });
const FamilyPanel = dynamic(() => import('./family/FamilyPanel'), { ssr: false, loading: Loading });
const ElderChatWidget = dynamic(() => import('./ai/ElderChatWidget'), { ssr: false });
import ReminderAlarm from './safety/ReminderAlarm';
import { cn } from './ui';

type Tab = 'tree' | 'safety' | 'decoder' | 'games' | 'family';
const TABS: { id: Tab; icon: typeof BookText }[] = [
  { id: 'tree', icon: TreeDeciduous },
  { id: 'safety', icon: ShieldAlert },
  { id: 'decoder', icon: BookText },
  { id: 'games', icon: Dices },
  { id: 'family', icon: Users },
];

export default function AppShell() {
  const { code, memberId } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // persisted state is only known in the browser
  if (!code || !memberId) return <Onboarding />;
  return <Home code={code} />;
}

function Home({ code }: { code: string }) {
  const { t } = useTranslation();
  const refresh = useFamilySync(code);
  const me = useMe();
  const { storySummary, members, memberId, setMemberId } = useApp();
  const [tab, setTab] = useState<Tab>('tree');
  const [themeOpen, setThemeOpen] = useState(false);
  const user = useAuthUser();
  useEffect(() => {
    refresh(); // signing in or out changes whether you are the owner
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // A saved profile that no longer exists (new database, deleted member): go back to the profile picker.
    if (memberId && members.length > 0 && !members.some((m) => m.id === memberId)) setMemberId(null);
  }, [members, memberId, setMemberId]);
  const youth = isYouth(me);
  const xp = (storySummary.authors[me?.name ?? ''] ?? 0) * 10;

  return (
    <>
      <TopBanner />
      <div className="mx-auto max-w-4xl p-4 pb-16">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t('app.name')}</h1>
            <p className="text-sm text-muted">{t('onb.familyCode')} <b className="tracking-widest">{code}</b></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {youth && (
              <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-fg">
                {t('youth.xp', { xp, lv: Math.floor(xp / 30) + 1 })}
              </span>
            )}
            <button onClick={() => setThemeOpen(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-theme border-2 border-border px-3 font-semibold hover:border-accent">
              <Palette size={18} /> {t('theme.title')}
            </button>
            <LanguageSelect />
            <button onClick={() => setMemberId(null)} className="inline-flex min-h-[44px] items-center gap-2 rounded-theme border-2 border-border px-3 font-semibold hover:border-accent">
              <span aria-hidden>{me?.avatar ?? <Users size={18} />}</span> {me?.name}
            </button>
          </div>
        </header>

        <nav role="tablist" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-theme border-2 px-2 py-2 font-semibold sm:flex-row sm:gap-2',
                tab === id ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-card hover:border-accent',
              )}
            >
              <Icon size={20} aria-hidden /> {t(`tabs.${id}`)}
            </button>
          ))}
        </nav>

        <main role="tabpanel">
          {tab === 'tree' && <MemoryTree />}
          {tab === 'safety' && <SafetyReminders />}
          {tab === 'decoder' && <GenZDecoder />}
          {tab === 'games' && <Games />}
          {tab === 'family' && <FamilyPanel refresh={refresh} />}
        </main>
      </div>
      <ReminderAlarm />
      <ElderChatWidget />
      <PaywallModal refresh={refresh} />
      <ThemePicker open={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}
