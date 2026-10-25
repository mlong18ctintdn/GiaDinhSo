import type { Plan } from './types';

const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

/** PRO plans. Prices are in VND and are always read on the server before a payment link is created. */
export const PLANS: Record<Plan, { amount: number; days: number }> = {
  monthly: { amount: num(process.env.NEXT_PUBLIC_PLAN_MONTHLY_VND, 39_000), days: 30 },
  yearly: { amount: num(process.env.NEXT_PUBLIC_PLAN_YEARLY_VND, 390_000), days: 365 },
};

/** Whole-number saving of the yearly plan versus 12 monthly payments (39k x 12 = 468k -> 16%). */
export const YEARLY_SAVE_PERCENT = Math.floor((1 - PLANS.yearly.amount / (PLANS.monthly.amount * 12)) * 100);
export const YEARLY_PER_MONTH = Math.round(PLANS.yearly.amount / 12);
