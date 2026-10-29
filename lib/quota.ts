import { serverSupabase } from "@/lib/supabase/server";

// 종류별 평생 무료 횟수. 이후 공통 지갑에서 차감하며 실패 건은 제외한다.
export const FREE_LIMITS = { pose: 2, concept: 1 } as const;
export type QuotaKind = keyof typeof FREE_LIMITS;

// 테스트 생성 제한 면제 계정. 배포 환경 설정에 의존하지 않도록 코드에 고정한다.
// 추가·삭제 시 이 목록만 수정하면 포즈·컨셉아트 쿼터 검사에 함께 반영된다.
const UNLIMITED_TEST_EMAILS = new Set([
  "naver159789@gmail.com",
  "lys40710@gmail.com",
]);

export function isUnlimitedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return UNLIMITED_TEST_EMAILS.has(email.trim().toLowerCase());
}

export type Quota = {
  pose: { used: number; limit: number; left: number };
  concept: { used: number; limit: number; left: number };
};

async function countUsed(userId: string, kind: QuotaKind): Promise<number> {
  const sb = serverSupabase();
  const { count, error } = await sb
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("owner", userId)
    .eq("kind", kind)
    .neq("status", "failed");
  if (error) throw error;
  return count ?? 0;
}

export async function getQuota(userId: string): Promise<Quota> {
  const [pose, concept] = await Promise.all([
    countUsed(userId, "pose"),
    countUsed(userId, "concept"),
  ]);
  return {
    pose: {
      used: Math.min(FREE_LIMITS.pose, pose),
      limit: FREE_LIMITS.pose,
      left: Math.max(0, FREE_LIMITS.pose - pose),
    },
    concept: {
      used: Math.min(FREE_LIMITS.concept, concept),
      limit: FREE_LIMITS.concept,
      left: Math.max(0, FREE_LIMITS.concept - concept),
    },
  };
}

export async function hasQuota(
  userId: string,
  kind: QuotaKind,
): Promise<boolean> {
  return (await countUsed(userId, kind)) < FREE_LIMITS[kind];
}

// 사전 검사일 뿐이며, 실제 무료 횟수 선택과 차감은 enqueue_metered_generation이 잠금 안에서 수행한다.
export async function canGenerate(userId: string, kind: QuotaKind): Promise<boolean> {
  if (await hasQuota(userId, kind)) return true;
  const wallet = await serverSupabase().from("wallets").select("balance").eq("user_id", userId).maybeSingle();
  if (wallet.error) throw wallet.error;
  return (wallet.data?.balance ?? 0) > 0;
}
