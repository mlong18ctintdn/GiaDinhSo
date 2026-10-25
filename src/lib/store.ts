'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Family, Locale, Member, Reminder, StorySummary, ThemeChoice, YouthFont } from './types';
import { EMPTY_SUMMARY } from './types';

const ymdNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export interface LocalTheme { theme?: ThemeChoice; font?: YouthFont }

interface AppState {
  code: string | null;
  memberId: string | null;
  locale: Locale;
  family: Family | null;
  members: Member[];
  storySummary: StorySummary;
  storiesRev: number; // goes up whenever stories change, so an open drawer reloads
  acks: Record<string, true>; // reminders marked done today: `${id}|${date}`
  reminders: Reminder[];
  access: { owned: boolean; isOwner: boolean };
  localThemes: Record<string, LocalTheme>; // saved on this device so a look never snaps back
  paywall: boolean;
  setCode: (c: string | null) => void;
  setMemberId: (id: string | null) => void;
  setLocale: (l: Locale) => void;
  setFamily: (f: Family | null) => void;
  setMembers: (m: Member[]) => void;
  setStorySummary: (s: StorySummary) => void;
  addStoryLocal: (year: number, author: string) => void;
  ackReminder: (id: string | number) => void;
  setUsage: (u: { used: number; limit?: number; premium?: boolean }) => void;
  setReminders: (r: Reminder[]) => void;
  setAccess: (a: { owned: boolean; isOwner: boolean }) => void;
  setLocalTheme: (memberId: string, t: LocalTheme) => void;
  setPaywall: (open: boolean) => void;
  logout: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      code: null,
      memberId: null,
      locale: 'vi',
      family: null,
      members: [],
      storySummary: EMPTY_SUMMARY,
      storiesRev: 0,
      acks: {},
      reminders: [],
      access: { owned: false, isOwner: false },
      localThemes: {},
      paywall: false,
      setCode: (code) => set({ code }),
      setMemberId: (memberId) => set({ memberId }),
      setLocale: (locale) => set({ locale }),
      setFamily: (family) => set({ family }),
      setMembers: (members) => set({ members }),
      setStorySummary: (storySummary) =>
        set((s) => (JSON.stringify(s.storySummary) === JSON.stringify(storySummary) ? {} : { storySummary, storiesRev: s.storiesRev + 1 })),
      addStoryLocal: (year, author) =>
        set((s) => {
          const years = s.storySummary.years.some((y) => y.year === year)
            ? s.storySummary.years.map((y) => (y.year === year ? { ...y, count: y.count + 1 } : y))
            : [...s.storySummary.years, { year, count: 1 }].sort((a, b) => a.year - b.year);
          return { storySummary: { years, authors: { ...s.storySummary.authors, [author]: (s.storySummary.authors[author] ?? 0) + 1 } }, storiesRev: s.storiesRev + 1 };
        }),
      ackReminder: (id) =>
        set((s) => {
          const today = ymdNow();
          const keep = Object.fromEntries(Object.entries(s.acks).filter(([k]) => k.endsWith(`|${today}`)));
          return { acks: { ...keep, [`${id}|${today}`]: true } };
        }),
      setReminders: (reminders) => set({ reminders }),
      setAccess: (access) => set({ access }),
      setLocalTheme: (id, t) => set((s) => ({ localThemes: { ...s.localThemes, [id]: t } })),
      // The server's count is the truth: every action answers with it (see lib/api.ts), so the banner can never drift.
      setUsage: (u) =>
        set((s) => (s.family ? { family: { ...s.family, usage_count: Math.max(0, Math.floor(u.used)) } } : {})),
      setPaywall: (paywall) => set({ paywall }),
      logout: () => set({ code: null, memberId: null, family: null, members: [], storySummary: EMPTY_SUMMARY, reminders: [], access: { owned: false, isOwner: false }, paywall: false }),
    }),
    {
      name: 'gia-dinh-so',
      partialize: (s) => ({ code: s.code, memberId: s.memberId, locale: s.locale, localThemes: s.localThemes, acks: s.acks }),
    },
  ),
);

export const useMe = () => useApp((s) => s.members.find((m) => m.id === s.memberId));
