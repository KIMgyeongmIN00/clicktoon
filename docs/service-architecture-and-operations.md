# 클릭툰 서비스 구조와 운영 준비

기준: **2026-10-19 저장소 코드**. 이 문서는 실서비스 운영을 위한 인수인계와 작업 계획이다. 코드에 존재한다는 것은 실제 배포·외부 서비스 설정·법적 적합성·장애 복구가 검증됐다는 뜻이 아니다. 실제 호스팅 제공자, 도메인, 배포 상태, 운영 DB 마이그레이션 버전, 백업 및 외부 서비스 설정은 이 조사에서 확인하지 않았다. 운영 환경을 확인한 뒤 담당자와 검증 일시를 별도로 기록한다.

## 1. 서비스와 현재 상태

클릭툰은 캐릭터 참조 이미지, 3D 인형 포즈·광원·장면 정보와 추가 프롬프트를 이용해 이미지 또는 캐릭터 컨셉아트를 생성하는 웹 앱이다. 비로그인 사용자는 일부 편집과 로컬 캐릭터 보관을 이용하고, AI 생성과 서버 데이터는 로그인 후 이용한다.

**현재는 유료 운영 준비가 끝난 상태가 아니다.** 결제창·서버 승인·크레딧 원장은 구현돼 있지만 생성 요청은 현재 `p_cost: 0`을 사용한다. 포즈 2회·컨셉아트 1회의 무료 쿼터로 제한하며, 지정된 테스트 계정은 이를 우회한다. 충전 화면의 테스트 안내와 마이페이지의 “충전해 계속 생성” 문구도 실제 생성 차감 경로와 함께 점검해야 한다. [생성 API](../app/api/generate/route.ts), [컨셉 API](../app/api/characters/from-concept/route.ts), [쿼터](../lib/quota.ts), [충전 화면](../app/(app)/charge/page.tsx)

## 2. 기술 스택과 경계

버전의 기준은 [package.json](../package.json)과 lockfile이다.

| 계층 | 현재 구현 | 주요 책임 |
| --- | --- | --- |
| 웹 | Next.js 16 App Router, React 19, TypeScript | 페이지, Route Handler, 세션 갱신 및 서버 검증 |
| UI·3D | Tailwind CSS 4, React Three Fiber, Drei, Three.js | 다크 UI, 3D 포즈·카메라·광원 편집 및 캡처 |
| 인증·데이터 | Supabase Auth, Postgres, Storage | 사용자 세션, 캐릭터·생성·원장, 비공개 이미지 저장 |
| 비동기 작업 | Trigger.dev SDK v4 | 생성 워커, 실패 재시도, 주기적 stuck 작업 정리 |
| 생성 모델 | Google Gen AI, OpenAI SDK | 공급자 어댑터를 통한 참조 이미지 기반 생성 |
| 결제 | Toss Payments SDK·서버 승인 API | 서버 주문, 결제 인증·승인, 크레딧 적립 |
| 공통 | Zod, Sonner, Lucide | 입력 스키마, 토스트, 아이콘 |

```text
브라우저: 편집기 / 로컬 캐릭터 / 로그인 / 폴링
   │ HTTPS + Supabase 세션 쿠키
   ▼
Next.js: 페이지·proxy·API ── Supabase Auth / Postgres / private Storage
   │                                  ▲             ▲
   │ generation ID / 서명된 URL        │ HMAC 콜백   │ 서명된 URL
   ▼                                  │             │
Trigger.dev 생성 워커 ── Google 또는 OpenAI 이미지 API
   │
   └─ 스케줄 reaper → Next API → 오래된 작업 실패 처리

브라우저 → Next 주문 생성 → Toss 결제창 → Next 승인 → 원장 적립
```

관리자 **사용자 역할이나 관리 콘솔은 현재 확인되지 않았다**. `service_role`은 서버가 사용하는 특권 자격 증명이지, 사람의 관리자 로그인 계정이 아니다. 데모 토글 API도 별도의 관리자 역할 체계가 아니다. [서버 클라이언트](../lib/supabase/server.ts), [데모 API](../app/api/admin/demo/route.ts)

## 3. 주요 사용자·데이터 흐름

### 3.1 인증과 캐릭터

1. [로그인 화면](../app/login/page.tsx)은 Google OAuth와 이메일·비밀번호 로그인을 제공한다. [인증 콜백](../app/auth/callback/route.ts)이 로그인 후 이동을 처리한다.
2. [proxy.ts](../proxy.ts)는 페이지 요청에서 Supabase `getUser()`로 세션을 갱신·확인한다. `/`, `/characters/**`, `/login`, `/auth/**`, `/policy/**`는 공개 범위이고 갤러리·마이페이지·충전은 로그인 대상으로 처리한다. API 경로는 proxy 매칭에서 제외되므로 **각 API가 별도로 인증·소유권을 확인해야 한다**.
3. 비로그인 캐릭터는 브라우저 저장소에 보관하고 로그인 후 서버와 동기화한다. 브라우저 데이터는 서버 백업이 아니며 삭제·기기 변경 시 유실될 수 있다. [로컬 캐릭터](../lib/local/characters.ts), [동기화](../lib/local/sync.ts)
4. 서버 API는 Supabase service-role 클라이언트를 사용한다. 이 경로는 RLS에만 의존할 수 없으므로 캐릭터·결과·주문마다 로그인 사용자와 소유자를 비교하는 코드가 보안 경계다. [캐릭터 API](../app/api/characters/route.ts), [단건 API](../app/api/characters/[id]/route.ts), [생성 결과 API](../app/api/generations/[id]/route.ts)

### 3.2 AI 이미지 생성

1. 편집기가 캐릭터·포즈·장면·렌더 캡처를 전송한다. [포즈 편집 화면](../app/(app)/page.tsx)
2. `POST /api/generate`는 로그인, 캐릭터 소유권, 무료 쿼터와 입력을 확인하고 렌더를 `renders` 버킷에 올린다. `enqueue_generation` RPC로 생성 행과 outbox를 기록한 뒤 큐를 호출하고 `generationId`를 반환한다.
3. 일반 경로의 [Trigger 큐](../lib/jobs/trigger.ts)는 DB와 Storage에서 입력을 준비하고 서명된 다운로드·업로드 정보를 워커에 넘긴다. [워커](../trigger/generate-image.ts)는 참조 이미지를 내려받아 선택한 공급자를 호출하고 결과를 업로드한다. API 키는 워커 환경에 필요하다.
4. 워커는 generation ID·시각·본문에 결합한 HMAC으로 Next 콜백을 호출한다. 콜백은 서명과 시각을 검증하고 `done` 또는 `failed`로 종결한다. 클라이언트는 생성 상태를 폴링한다. [콜백](../app/api/generations/[id]/callback/route.ts), [상태 전이](../lib/generation/finalize.ts)
5. 컨셉아트는 별도 API로 enqueue하지만 같은 워커·공급자 추상화를 사용한다. [컨셉 API](../app/api/characters/from-concept/route.ts), [어댑터](../lib/providers/index.ts)

상태는 `queued → processing → done/failed` 형태다. 다만 Trigger 경로의 시작·상태 전이와 outbox의 실제 사용 방식은 [기존 큐 문서](./ai-generation-queue-reliability.md) 및 현재 코드와 함께 검증한다. 10분마다 실행되는 reaper는 30분 이상 `queued`/`processing`이고 결과 경로가 없는 행을 실패 처리한다. [스케줄](../trigger/reaper.ts), [reaper API](../app/api/jobs/reap/route.ts)

`TRIGGER_SECRET_KEY`가 없으면 API는 개발용 인프로세스 [stub 큐](../lib/jobs/stub.ts)로 전환한다. 서버리스에서는 응답 후 작업 완료가 보장되지 않으므로 운영 설정 누락을 정상 대체 경로로 취급하면 안 된다. 데모 모드는 실제 모델 대신 미리 준비된 이미지를 복사한다. [데모 흐름](./demo-flow.md)

### 3.3 결제와 크레딧

1. `POST /api/payments/orders`가 로그인 사용자용 주문번호·금액·크레딧을 서버에서 발급한다.
2. 브라우저가 Toss 결제창을 열고, 성공 후 `POST /api/payments/confirm`이 주문 소유자·금액을 대조해 Toss 승인 API를 호출한다.
3. 승인 후 주문을 `paid`로 변경하고 `credit_topup` RPC로 크레딧을 적립한다. 결제키 기반 중복 적립 방지 장치가 있다. [주문](../app/api/payments/orders/route.ts), [승인](../app/api/payments/confirm/route.ts), [원장](../supabase/migrations/0004_credits.sql)
4. 현재 상품은 테스트용 1,000원/100크레딧이며 실제 생성에는 차감하지 않는다. [상품](../lib/payments/packs.ts)

**유료 전환 전 중요:** 주문의 `paid` 업데이트와 적립은 별도 호출이며 업데이트 결과도 확인하지 않는다. 승인 이후 적립이 실패하면 재호출이 이미 `paid`인 주문으로 조기 반환해 복구되지 않을 가능성이 있다. 원자적 상태 전이·재시도·결제사와의 정산 대사, 중복 승인 및 장애 주입 테스트를 완료하기 전에는 유료 운영 가능하다고 판단하지 않는다.

## 4. 데이터와 접근 제어

마이그레이션은 [supabase/migrations](../supabase/migrations/)의 `0001`부터 `0010`까지 순서대로 확인한다. 최초 SQL 하나만 적용하면 현재 서비스 스키마가 되지 않는다. 실제 운영 DB에 적용된 버전은 별도 확인이 필요하다.

| 데이터 | 목적 |
| --- | --- |
| `characters`, `character_assets` | 사용자 캐릭터, 참조·컨셉 이미지와 메타데이터 |
| `generations`, `generation_characters` | 작업 상태·입력·결과와 복수 캐릭터 관계 |
| `job_outbox` | enqueue 시 생성되는 작업 기록. 실제 전달·재처리 동작은 구현과 함께 검증 |
| `wallets`, `credit_ledger`, `payment_orders` | 사용자 잔액·크레딧 원장·주문 |
| `refs`, `renders`, `results` Storage | 참조 이미지·포즈 렌더·결과 이미지. 비공개 버킷과 서명 URL 사용 |

RLS 정책은 사용자별 읽기 방어선이다. 서버 service-role은 RLS를 우회하므로 API 소유권 검사, RPC 실행 권한과 Storage 서명 URL의 범위·유효기간을 함께 검증해야 한다. DB 백업과 Storage 백업은 별도이며 복구 시험 없이는 복구 가능성을 주장하지 않는다.

## 5. 디자인 시스템과 UI

현재는 완성된 외부 디자인 시스템이 아니라 Tailwind와 소규모 공통 컴포넌트로 구성된 **다크 테마 중심의 내부 시스템**이다.

| 토큰 | 값 | 용도 |
| --- | --- | --- |
| `--background` / `--foreground` | `#0b0b0d` / `#f5f5f7` | 화면 바탕 / 기본 글자 |
| `--surface` / `--surface-2` | `#14141a` / `#1c1c24` | 카드·컨트롤 배경 |
| `--border` / `--muted` | `#2a2a35` / `#a4a4ad` | 경계선 / 보조 글자 |
| `--accent` / `--accent-fg` | `#8b5cf6` / `#ffffff` | 주요 행동 / 강조 위 글자 |
| `--danger` | `#ef4444` | 위험·오류 |

토큰과 Tailwind 매핑은 [globals.css](../app/globals.css), Geist/Geist Mono와 다크 Sonner 토스트는 [루트 레이아웃](../app/layout.tsx)에 있다. `components/ui/`는 Button·Input·Textarea·Label·Card를 제공한다. Button은 `default`, `secondary`, `ghost`, `outline`, `danger`와 `default`, `sm`, `lg`, `icon` 크기를 지원한다. [버튼](../components/ui/button.tsx)

공통 앱 레이아웃은 내비게이션·본문·푸터로 구성되고 3D 편집 패널은 [components/pose-editor](../components/pose-editor/)에 있다. 신규 화면은 기존 토큰·primitive와 포커스/비활성 상태를 재사용한다. 키보드 접근, 스크린리더, 색상 대비, 모바일·저사양 기기 및 3D 대체 조작에 대한 체계적 검증 자료는 확인되지 않았다. 운영 전 실제 기기에서 검증하고 결과를 별도 기록한다.

## 6. 에이전트와 개발 규칙

- [AGENTS.md](../AGENTS.md)는 저장소의 최상위 에이전트 작업 지침이다. 특히 이 프로젝트는 Next.js 버전에 차이가 있을 수 있으므로 **Next 관련 코드를 작성하기 전 `node_modules/next/dist/docs/`의 해당 가이드를 읽는다**.
- [CLAUDE.md](../CLAUDE.md)는 `@AGENTS.md`를 참조하고 Trigger.dev v4의 `@trigger.dev/sdk` 사용 등 추가 지침을 담는다. 특정 에이전트용 문서가 프로젝트 최상위 규칙을 대체하지 않는다.
- 변경은 기존 동작·데이터를 보존하고 작은 단위로 검증한다. 커밋은 AGENTS.md의 Lore 형식을 따른다. 외부 서비스 설정·운영 데이터·비밀 값 변경은 로컬 코드 변경과 구분해 검토한다.
- 설계 문서의 미래 계획, 주석의 가정, 실제 배포 설정은 서로 다를 수 있다. 새 에이전트는 관련 경로와 마이그레이션을 먼저 확인하고, 불확실한 운영 상태를 사실로 기록하지 않는다.

## 7. 개발·검증·배포

### 로컬 개발

1. Node.js 및 npm을 준비하고 `npm ci`로 lockfile 기준 의존성을 설치한다. 지원 Node 버전은 저장소에 명시적으로 고정돼 있지 않으므로 팀에서 정하고 CI·호스팅·Trigger 런타임과 일치시킨다.
2. 필요한 환경변수를 로컬의 무시된 환경 파일 또는 안전한 시크릿 저장소에 설정한다. `.env.example`은 Trigger/콜백 설정을 모두 설명하지 않으므로 아래 표와 코드를 함께 확인한다. **실제 값을 Git, 문서, 로그에 넣지 않는다.**
3. `npm run dev`로 실행한다. package script의 포트는 **1059**다.
4. 현재 확인 가능한 기본 검증은 `npm run lint`, `npx tsc --noEmit`, `npm run build`다. build는 `next/font/google`의 폰트 다운로드 등 빌드 환경의 외부 네트워크에 영향을 받을 수 있다.

현재 `package.json`에 자동 테스트 스크립트는 없으며 Playwright 의존성이 있다는 사실만으로 E2E가 구축됐다고 볼 수 없다. 테스트·CI·운영 스모크를 아래 운영 준비 항목으로 추가한다.

### 환경변수 배치

실제 값은 기록하지 않는다. `NEXT_PUBLIC_` 변수는 브라우저에 노출되는 설정이므로 비밀을 넣지 않는다. Next의 클라이언트용 공개 변수는 빌드 시점 반영 여부도 고려한다.

| 변수 | 사용 위치 | 성격 / 확인 사항 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 웹·브라우저, 워커 업로드 | 공개 설정. 프로젝트와 환경이 일치해야 한다. |
| `SUPABASE_SERVICE_ROLE_KEY` | Next 서버 | 비밀·RLS 우회. 브라우저·워커 페이로드·로그에 노출 금지. |
| `TRIGGER_SECRET_KEY` | Next 서버 | Trigger 작업 발행용 비밀. 누락 시 개발용 stub 폴백. |
| `WORKER_CALLBACK_SECRET` | Next 서버와 Trigger 워커 | 두 환경에 동일한 비밀. 콜백 및 reaper HMAC 검증. |
| `APP_URL` | Next 서버, Trigger 스케줄 | 공개 서비스의 정확한 원본 URL. 콜백·reaper 연결에 사용. |
| `GOOGLE_GEMINI_API_KEY`, `OPENAI_API_KEY` | Trigger 워커; 로컬 stub도 사용 | 공급자 비밀. 공급자별 과금·사용 한도·접근 권한 확인. |
| `GOOGLE_IMAGE_MODEL`, `OPENAI_IMAGE_MODEL` | 생성 실행 환경 | 공급자 모델 지정. 기본값과 실제 접근 가능 여부 확인. |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY` | 웹 클라이언트 / Next 서버 | 각각 공개 클라이언트 키 / 비밀 승인 키. 테스트·운영 키를 혼용하지 않는다. |
| `ADMIN_DEMO_SECRET` | Next 서버 | 데모 토글 비밀. URL 쿼리에 들어가므로 로그·브라우저 기록 노출 위험에 주의. 미사용 시 비활성화. |

무료 생성 면제는 현재 [코드 내 테스트 계정 목록](../lib/quota.ts)으로 관리하며 `UNLIMITED_EMAILS` 환경변수는 사용하지 않는다. 면제 계정도 외부 AI 공급자의 요금·한도는 우회하지 못한다.

### 배포 절차와 미확인 사항

1. 운영/스테이징 각각의 Git 브랜치·커밋, 호스팅 프로젝트·도메인, Supabase 프로젝트, Trigger 프로젝트·환경, Toss 및 AI 공급자 프로젝트를 식별한다. 현재 저장소만으로 Git push와 실제 배포의 연결·성공을 보장할 수 없다.
2. 변경사항 리뷰 후 린트·타입 검사·테스트·빌드를 통과시킨다. DB 변경은 백업·호환성·적용 순서·롤백 계획을 먼저 마련하고 스테이징에서 적용한다. 무조건 운영 DB에 마이그레이션을 실행하지 않는다.
3. 웹 배포와 Trigger 워커 배포는 별개로 확인한다. 워커 코드·시크릿·스케줄이 운영 환경에 반영됐는지 점검한다. 배포 순서와 이전 페이로드 호환성을 확인한다.
4. 배포 후 실제 대상 URL과 배포 커밋을 대조하고, 테스트 계정으로 로그인·캐릭터·각 공급자 생성·폴링·갤러리·실패 처리와 데모 비활성 상태를 확인한다. 결제는 우선 별도 테스트 환경에서 검증한다. 유료 호출은 비용이 발생할 수 있다.
5. 오류율·큐 지연·콜백·결제 대사·공급자 사용량을 확인하고 문제가 있으면 준비된 롤백 절차를 수행한다. 웹 롤백만으로 DB·워커·외부 결제가 함께 롤백되는 것은 아니다.

## 8. 실서비스 전 우선순위와 완료 기준

### P0 — 운영 차단 또는 출시 전 필수

- [ ] **결제 정합성:** 승인 성공/DB 업데이트 실패/적립 실패/중복 콜백·재시도/동시 요청을 테스트하고 원장·주문·Toss 대사 및 복구 절차를 구현한다. 현재 테스트 결제 문구와 실제 키 상태를 확인한다.
- [ ] **요금 정책:** 무료·유료 전환 조건, 모델별 실비·크레딧 가격, 실패/환불을 확정하고 `p_cost: 0`, UI와 환불정책을 실제 동작과 일치시킨다. 자동 환불의 운영 처리까지 검증한다.
- [ ] **개인정보와 소비자 고지:** 현재 푸터에는 환불정책 링크가 있으나 이용약관·개인정보 처리방침 링크와 사업자 이메일은 확인되지 않는다. 정확한 사업자 정보, 신고기관, 개인정보 처리·위탁·국외 이전 여부, 보유·삭제, 문의·환불 절차를 실 운영 사실에 맞춰 작성하고 법률·PG 검토를 받는다. [푸터](../components/footer.tsx), [환불정책](../app/(app)/policy/refund/page.tsx)
- [ ] **시크릿 관리:** 개발·운영 키 분리, 최소 권한, 저장소·로그 노출 점검, 만료·회전 절차를 마련한다. 이전 조사 과정에서 키가 도구 출력에 노출될 가능성이 있었으므로 해당 공급자 키를 폐기·교체하고 배포 환경에 새 값을 반영했는지 확인한다. 데모 URL의 비밀 누출 위험도 해소한다.
- [ ] **권한·남용 방어:** service-role 사용 API와 RPC의 소유권·RLS를 교차 계정 테스트한다. 쿼터 조회와 enqueue는 별도여서 동시 요청 시 제한을 초과할 가능성이 있으므로 원자적 제한과 레이트 리밋을 검증한다. 테스트 면제 계정의 사용량·비용 상한도 정한다.
- [ ] **데이터 보호·복구:** 개인 데이터 흐름·접근 권한·보존/삭제 정책, DB와 Storage 백업, 복구 목표 및 실제 복원 시험을 확정한다. 사용자 탈퇴와 고아 Storage 객체 정리도 검증한다.

### P1 — 안정적인 출시와 운영을 위한 필수 기반

- [ ] **생성 신뢰성:** Trigger가 없는 운영 설정에서 stub로 조용히 전환되지 않도록 운영 검증을 마련한다. 입력 업로드·DB enqueue·큐 발행 사이 실패와 고아 데이터의 복구를 시험한다. reaper의 30분 기준은 워커 `maxDuration` 3,600초보다 짧아 정상 장시간 작업도 실패 처리될 수 있으므로 실제 타임아웃·하트비트·재시도 정책을 정합시킨다.
- [ ] **모니터링·알림:** 웹 5xx, 생성 성공률·지연·stuck 수, 콜백 실패, 공급자별 429/비용, 결제 승인·적립 불일치, DB/Storage 용량과 백업 실패를 수집하고 담당자·임계값·호출 경로를 정한다. 로그에는 키, signed URL, 개인 이미지·프롬프트를 무분별하게 남기지 않는다.
- [ ] **테스트·CI:** 단위(쿼터·프롬프트·서명), 통합(소유권·RPC·상태전이·중복 처리), E2E(로그인·캐릭터·생성·결제 테스트), 실패 주입 및 모바일/접근성 테스트를 구축한다. CI에서 lint·typecheck·test·build를 실행한다.
- [ ] **배포·환경:** 스테이징과 운영의 호스팅/DB/워커/공급자 분리, Node 버전 고정, 배포 승인·스모크·롤백, 마이그레이션 및 Trigger 스케줄 배포 방법을 문서화하고 실제로 리허설한다.
- [ ] **사용자 경험:** 쿼터 면제 계정의 마이페이지 표시, 테스트 결제 안내, 결제 후 생성 가능 여부, 로컬 데이터 유실 안내, 오류 메시지와 고객지원 경로를 실제 정책과 일치시킨다.

### P2 — 지속 운영과 확장

- [ ] 사람용 관리자 역할·최소 권한 관리 화면·감사 로그·계정 비활성화 절차를 설계한다. service-role 키나 데모 비밀을 관리자 로그인 수단으로 사용하지 않는다.
- [ ] 이미지 업로드 용량·형식 제한, 스토리지 수명주기·비용, 공급자 장애 대체·모델 변경 검증, 접근성·성능 예산, 고객지원·장애 공지 절차를 확립한다.
- [ ] 오래된 README와 설계 문서를 현재 구조에 맞춰 갱신하고 변경 시 코드·문서·운영 설정의 담당자를 지정한다.

## 9. 장애 대응 출발점

| 증상 | 우선 확인 | 주의 |
| --- | --- | --- |
| 생성 대기·시간 초과 | `generations` 상태·시각, Trigger 실행·스케줄, 콜백 URL/HMAC, Storage URL 만료, reaper 실행 | 실제 운영 데이터는 조사 전 수정·재실행하지 않는다. 재시도 시 중복 비용·결과를 고려한다. |
| 공급자 429 | 워커의 해당 공급자 프로젝트·사용량·rate limit·과금 상태, 실제 오류 코드 | 이 앱의 무료 쿼터 면제와 공급자 한도는 별개다. 코드가 429를 단일 메시지로 묶어 세부 원인이 저장되지 않을 수 있다. |
| 승인됐으나 크레딧 없음 | Toss 승인 기록, `payment_orders`, `credit_ledger`, `wallets`를 주문·결제키로 대조 | 원장 직접 수정·재승인은 중복 적립/결제 위험이 있으므로 승인된 복구 절차와 감사 기록이 필요하다. |
| 타인 데이터 노출 의심 | 영향 범위와 접근 로그 보존, 해당 API의 사용자 소유권·service-role 경로 확인 | 비밀 회전·접근 제한·통지 등은 사고 대응 절차와 법적 의무에 따라 진행한다. |

운영 연락처, 알림 채널, 소유자, 도메인, 배포·대시보드 링크, 복구 목표와 담당자 교대 정보는 보안이 확보된 별도 운영 문서에 채워야 한다. 이 문서는 법률 자문이나 보안 인증이 아니다.
