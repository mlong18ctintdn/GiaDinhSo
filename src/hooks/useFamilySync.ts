'use client';
import { useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { useApp } from '@/lib/store';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Family, Member, Reminder, StorySummary } from '@/lib/types';

/**
 * Loads the household and keeps it live: the server broadcasts on `family:<code>`
 * after every story save and payment, so the tree grows and the paywall lifts
 * without a page reload. A slow poll is the safety net.
 */
export function useFamilySync(code: string) {
  const { setFamily, setMembers, setStorySummary, setReminders, setAccess, logout } = useApp();

  const refresh = useCallback(async () => {
    try {
      const [f, s, r] = await Promise.all([
        api<{ family: Family; members: Member[]; owned: boolean; isOwner: boolean }>(`/api/families/${code}`),
        // Only counts per year: the tree draws from this, stories themselves load per year, a page at a time.
        api<StorySummary>(`/api/stories?code=${code}&summary=1`).catch(() => null),
        // Separate fallback: if the reminders table is not created yet, the rest still works.
        api<{ reminders: Reminder[] }>(`/api/reminders?code=${code}`).catch(() => ({ reminders: [] as Reminder[] })),
      ]);
      setFamily(f.family);
      setAccess({ owned: f.owned, isOwner: f.isOwner });
      setMembers(f.members);
      if (s) setStorySummary(s);
      setReminders(r.reminders);
    } catch (e) {
      if (e instanceof Error && e.message === 'not_found') logout();
    }
  }, [code, setFamily, setMembers, setStorySummary, setReminders, setAccess, logout]);

  useEffect(() => {
    refresh();
    const sb = supabaseBrowser();
    const channel = sb
      .channel(`family:${code}`)
      .on('broadcast', { event: '*' }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 30000);
    return () => {
      clearInterval(poll);
      sb.removeChannel(channel);
    };
  }, [code, refresh]);

  return refresh;
}
