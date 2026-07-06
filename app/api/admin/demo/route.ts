import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { demoCookieToken, demoConfigured } from "@/lib/demo";
import { DEMO_COOKIE, DEMO_UI_COOKIE } from "@/lib/demo-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 숨겨진 어드민 토글 — 이 브라우저만 시연 모드 on/off (배포 환경에서 런타임, 재배포 불필요).
//   켜기: /api/admin/demo?key=<ADMIN_DEMO_SECRET>
//   끄기: /api/admin/demo?key=<ADMIN_DEMO_SECRET>&off=1
// 실패/미설정은 전부 404로 응답해 기능 존재 자체를 숨긴다.
export async function GET(req: NextRequest) {
  const notFound = new NextResponse("Not Found", { status: 404 });
  if (!demoConfigured()) return notFound;

  const key = req.nextUrl.searchParams.get("key") ?? "";
  const expected = process.env.ADMIN_DEMO_SECRET ?? "";
  const keyBuf = Buffer.from(key);
  const expBuf = Buffer.from(expected);
  const match =
    keyBuf.length === expBuf.length && crypto.timingSafeEqual(keyBuf, expBuf);
  if (!match) return notFound;

  const off = req.nextUrl.searchParams.get("off") === "1";
  const secure = req.nextUrl.protocol === "https:";
  const res = NextResponse.redirect(
    new URL(off ? "/?demo=off" : "/?demo=on", req.nextUrl.origin),
  );

  if (off) {
    res.cookies.set(DEMO_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(DEMO_UI_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    const maxAge = 60 * 60 * 8; // 8시간 후 자동 만료
    res.cookies.set(DEMO_COOKIE, demoCookieToken(), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge,
    });
    res.cookies.set(DEMO_UI_COOKIE, "1", {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure,
      maxAge,
    });
  }
  return res;
}
