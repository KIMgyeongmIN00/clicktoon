import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16: middleware → proxy. 요청마다 Supabase 세션을 갱신하고, 비로그인 유저를
// 보호된 페이지에서 /login으로 보낸다. (API 라우트는 matcher에서 제외 — 워커 콜백 등은
// 자체 HMAC 인증, 유저 API는 라우트에서 세션 체크 — C3)
const PUBLIC_PREFIXES = ["/login", "/auth"];

export default async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser()가 세션을 검증·갱신한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  // api / 정적 파일 / 확장자 있는 파일 제외 → 페이지 라우트에서만 실행
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
