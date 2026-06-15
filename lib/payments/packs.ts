// Credit packs available for purchase.
// TEMP: a single test pack (₩1,000 → 100 credits) while we validate the Toss
// payment-window flow without login/DB.
// TODO(pricing): replace with the real pack catalog once pricing is finalized,
//   and source the amount→credits mapping from the server (orders table).

export type CreditPack = {
  id: string;
  credits: number;
  amount: number; // KRW
  orderName: string;
};

export const CREDIT_PACK: CreditPack = {
  id: "test-100",
  credits: 100,
  amount: 1000,
  orderName: "클릭툰 크레딧 100",
};
