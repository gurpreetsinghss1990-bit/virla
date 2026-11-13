export type CreditLotLike = {
  id?: string;
  remaining_credits?: number | null;
  official_expiry_date?: string | null;
  [key: string]: any;
};

export const sumLotCredits = (lots?: CreditLotLike[] | null): number =>
  (lots ?? []).reduce((sum, lot) => sum + Math.max(0, Number(lot?.remaining_credits) || 0), 0);

/**
 * credit_lots can drift from user_profiles.credits_balance (bookings and refunds used
 * to move only the balance). The balance is authoritative, so cap the per-lot amounts
 * FIFO by expiry: the breakdown never claims more credits than the user actually holds.
 */
export function clampLotsToBalance<T extends CreditLotLike>(
  lots: T[] | null | undefined,
  balance: number | null | undefined
): T[] {
  if (!Array.isArray(lots) || lots.length === 0) return [];

  let left = Math.max(0, Number(balance) || 0);
  if (left === 0) return [];

  const order = [...lots].sort(
    (a, b) =>
      new Date(a.official_expiry_date ?? 0).getTime() - new Date(b.official_expiry_date ?? 0).getTime()
  );

  const allocation = new Map<T, number>();
  for (const lot of order) {
    if (left <= 0) break;
    const take = Math.min(Math.max(0, Number(lot.remaining_credits) || 0), left);
    allocation.set(lot, take);
    left -= take;
  }

  return lots
    .map((lot) => ({ ...lot, remaining_credits: allocation.get(lot) ?? 0 }))
    .filter((lot) => Number(lot.remaining_credits) > 0);
}
