import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 요청 범위 세션 클라이언트 (쿠키 기반, anon 키 + 유저 JWT). auth.uid() 확인용.
// service-role 클라이언트(lib/supabase/server.ts)와 별개 — 이건 "현재 로그인 유저"를 읽는다.
export async function sessionSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출되면 set 불가 — proxy가 세션을 갱신하므로 무시.
          }
        },
      },
    },
  );
}

// 현재 로그인 유저 (없으면 null).
export async function getSessionUser() {
  const sb = await sessionSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user;
}
