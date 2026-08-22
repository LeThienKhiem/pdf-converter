/**
 * Central mapping of Paddle price IDs → product plans.
 * All values come from env so sandbox/production can differ per deploy.
 * NEXT_PUBLIC_ prefix because the same IDs are needed client-side to open checkouts.
 */

export const PADDLE_PRICES = {
  /** Legacy one-time 50-credit pack ($9.99). */
  credits50: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID ?? "",
  /** One-time Week Pass ($2, 7 days). */
  weekPass: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_WEEK_PASS ?? "",
  /** Pro monthly subscription ($5/mo). */
  proMonthly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_MONTHLY ?? "",
  /** Pro yearly subscription ($39/yr). */
  proYearly: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_YEARLY ?? "",
  /** Founding member subscription ($3/mo forever, first 50 subscribers). */
  proFounding: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO_FOUNDING ?? "",
} as const;

export type PurchaseKind =
  | "credits50"
  | "week_pass"
  | "pro"
  | "pro_yearly"
  | "pro_founding"
  | "unknown";

export function classifyPriceId(priceId: string | null | undefined): PurchaseKind {
  if (!priceId) return "unknown";
  if (priceId === PADDLE_PRICES.credits50) return "credits50";
  if (priceId === PADDLE_PRICES.weekPass) return "week_pass";
  if (priceId === PADDLE_PRICES.proMonthly) return "pro";
  if (priceId === PADDLE_PRICES.proYearly) return "pro_yearly";
  if (priceId === PADDLE_PRICES.proFounding) return "pro_founding";
  return "unknown";
}

export const FOUNDING_MEMBER_CAP = 50;
