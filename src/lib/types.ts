export type Role = 'grandparent' | 'parent' | 'teen' | 'child';
export type Locale = 'vi' | 'zh' | 'en' | 'es';
export type YouthTheme = 'neon' | 'pastel' | 'cyber';
/** 'default' = the look that belongs to the member's role (cream for grandparents, slate for parents). */
export type ThemeChoice = 'default' | YouthTheme;
export type YouthFont = 'sans' | 'round' | 'grotesk';
export type Plan = 'monthly' | 'yearly';

export interface Family {
  id: string;
  family_code: string;
  usage_count: number;
  is_premium: boolean;
  plan_type: 'free' | Plan;
  premium_expires_at: string | null;
}
export interface Member {
  id: string;
  family_code: string;
  name: string;
  role: Role;
  avatar: string | null;
  custom_theme: { theme?: ThemeChoice; font?: YouthFont } | null;
}
export interface Story {
  id: string;
  family_code: string;
  year: number;
  title: string;
  content: string;
  author_name: string;
  photo_url: string | null;
  audio_url: string | null;
  created_at: string;
}
export type Repeat = 'daily' | 'weekdays' | 'once';
export interface Reminder {
  id: string | number; // a number when the table came from an older version
  family_code: string;
  member_id: string | null; // null = the whole family
  text: string;
  remind_time: string; // "HH:MM", in each viewer's local time
  repeat: Repeat;
  once_date: string | null; // "YYYY-MM-DD" when repeat = once
  created_by: string | null;
  created_at: string;
}
export interface GenZWord {
  id?: string;
  word: string;
  definition: string;
  solution_for_parents: string;
  context_example: string;
}

export interface StorySummary { years: { year: number; count: number }[]; authors: Record<string, number> }
export const EMPTY_SUMMARY: StorySummary = { years: [], authors: {} };
export const FREE_LIMIT = 5;
export const LOCALES: Locale[] = ['vi', 'zh', 'en', 'es'];

export const usedOf = (f: Family | null) => Number(f?.usage_count) || 0; // null from an old database counts as 0

export function isPremiumActive(f: Family | null): boolean {
  return !!f && f.is_premium && (!f.premium_expires_at || new Date(f.premium_expires_at) > new Date());
}
