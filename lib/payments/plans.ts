export const SUBSCRIPTION_PLANS = [
  { id: "basic", name: "베이직 플랜", amount: 170000, uses: 50 },
  { id: "pro", name: "프로 플랜", amount: 320000, uses: 200 },
  { id: "premium", name: "프리미엄 플랜", amount: 500000, uses: 312 },
] as const;

export type PlanId = (typeof SUBSCRIPTION_PLANS)[number]["id"];

export function findPlan(id: unknown) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === id);
}
