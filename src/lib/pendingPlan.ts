import type { PlanKey } from '@/api/services/payment.service';

const KEY = 'votexpert_pending_plan';

export function getPendingPlan(): PlanKey | null {
  try { return sessionStorage.getItem(KEY) as PlanKey | null; }
  catch { return null; }
}

export function setPendingPlan(plan: PlanKey): void {
  try { sessionStorage.setItem(KEY, plan); }
  catch { /* ignore in SSR/restricted contexts */ }
}

export function clearPendingPlan(): void {
  try { sessionStorage.removeItem(KEY); }
  catch { /* ignore */ }
}
