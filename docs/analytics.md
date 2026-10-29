# Mixpanel 행동 분석

US 프로젝트를 연결했다. `next.config.ts`에 공개 수집용 토큰을 배포 기본값으로 두고, **Vercel 운영 배포에서만 자동 활성화**한다. 개발·미리보기·일반 로컬 빌드는 기본 비활성화다. 명시한 환경변수가 기본값보다 우선하며, `NEXT_PUBLIC_ANALYTICS_ENABLED=false`로 끌 수 있다. 토큰이 비어 있거나 활성화가 false면 SDK 초기화·식별·이벤트 전송을 하지 않는다. Sentry는 설치하지 않았다.

## 중앙 레지스트리와 연결 구조

[`lib/analytics/events.ts`](../lib/analytics/events.ts)가 이벤트 이름, 허용 속성의 Zod 스키마, 브라우저/서버 구분, 설명, 사용 위치의 단일 기준이다. 각 호출부는 `track` 또는 `trackServer`를 사용한다. SDK를 기능 코드에서 직접 호출하지 않는다. 속성 타입은 레지스트리에서 추론하고 실행 시에도 검증한다. 알 수 없는 속성은 제거하며 잘못된 값은 전송하지 않는다.

| 파일 | 책임 |
| --- | --- |
| [events.ts](../lib/analytics/events.ts) | 이벤트 계약·설명·사용처 |
| [config.ts](../lib/analytics/config.ts) | 활성화, 환경, 리전, 내부 사용자, 경로 정규화 |
| [browser.ts](../lib/analytics/browser.ts) | 공식 `mixpanel-browser` SDK 설정, 로그인 식별, 타입이 있는 브라우저 전송 |
| [server.ts](../lib/analytics/server.ts) | Track API, 서버 신뢰 ID, 중복 식별자, 1.5초 제한, 오류 격리 |
| [generation.ts](../lib/analytics/generation.ts) | 실제 상태 전이 결과를 생성 이벤트로 변환 |
| [AnalyticsProvider](../components/analytics-provider.tsx) | 페이지 방문, Supabase 인증 상태 구독, 로그인 완료·로그아웃 |

## 이벤트 목록과 사용처

아래 위치는 프로젝트 루트 기준이며 같은 목록이 레지스트리의 `locations`에도 들어 있다. 브라우저 이벤트는 사용자가 수행한 행동이고, 서버 이벤트는 서버가 확인한 결과다.

| 이벤트 | 발생 조건 / 분석 용도 | 이벤트 속성 | 발생 위치 |
| --- | --- | --- | --- |
| `page_viewed` | 초기 진입과 pathname 변경; `/charge` 필터로 충전 화면 진입 분석 | page, referrer_host?, utm_source?, utm_medium?, utm_campaign? | `components/analytics-provider.tsx` |
| `login_started` | Google 또는 비밀번호 인증 요청 직전 | method | `app/login/page.tsx` |
| `login_completed` | 이 탭에서 10분 이내 시작한 로그인 후 인증 세션 확인; 단순 세션 복원 제외 | 없음 | `components/analytics-provider.tsx` |
| `logout_completed` | 로그아웃 확인 및 익명 식별자로 초기화 후 | 없음 | `components/analytics-provider.tsx` |
| `character_creation_started` | 새 캐릭터 화면의 최초 모드 및 모드 변경 | mode | `app/(app)/characters/new/page.tsx` |
| `character_step_completed` | 유효성 검사를 통과해 업로드 퍼널의 다음 단계로 이동 | step (0부터) | 같은 파일 |
| `character_created` | 로컬 저장 또는 서버 생성 응답 성공. 컨셉 모드는 캐릭터 row 생성이며 컨셉 이미지 완성과 구분 | mode, storage | 같은 파일 |
| `character_selected` | 사용자가 피규어에 캐릭터 배정; 자동 배정 제외 | 없음 | `app/(app)/page.tsx` |
| `pose_preset_applied` | 단일·2인 프리셋 직접 적용 | preset_id, preset_type | 같은 파일 |
| `pose_edited` | 관절 슬라이더·회전 기즈모·인물 이동/회전을 1초 유휴 후 묶어서 집계 | edit_count | 같은 파일 |
| `figure_added` | 수동 추가 또는 2인 프리셋의 상대역 자동 추가 | figure_count, via | 같은 파일 |
| `figure_removed` | 최소 1명 유지 조건을 통과한 삭제 | figure_count | 같은 파일 |
| `generation_requested` | 인증·캐릭터 입력 검사 이후 생성 시도; 서버 접수 성공을 뜻하지 않음 | kind, provider, figure_count, aspect, render_mode | `app/(app)/page.tsx`, `app/(app)/characters/new/page.tsx` |
| `generation_queued` | DB enqueue 성공; 클라이언트 창을 닫아도 기록 시도 | generation_id, kind, provider | `app/api/generate/route.ts`, `app/api/characters/from-concept/route.ts` |
| `generation_succeeded` | 조건부 DB 갱신으로 queued/processing에서 done으로 실제 전이 | generation_id, kind, provider, elapsed_ms | `lib/generation/finalize.ts` |
| `generation_failed` | queued/processing에서 failed로 실제 전이; 백스톱 정리 포함 | generation_id, kind, provider, elapsed_ms, failure_type | `lib/generation/finalize.ts`, `app/api/jobs/reap/route.ts` |
| `generation_request_failed` | 캡처/네트워크 또는 HTTP 접수 실패; 작업 최종 실패나 폴링 타임아웃과 구분 | kind, stage, status? | 두 생성 화면 |
| `generation_retry_requested` | 실패 안내의 다시 시도 클릭. 포즈는 생성 재실행, 컨셉은 입력 화면 복귀 | kind | 두 생성 화면 |
| `quota_limit_reached` | 서버 무료 한도 검사에서 실제 거절 | kind | 두 enqueue API |
| `pose_capture_downloaded` | 포즈 PNG 다운로드를 브라우저에 요청; 디스크 저장 완료 확인 아님 | figure_count | `app/(app)/page.tsx` |
| `checkout_started` | 주문 발급 후 이니시스 심사용 결제 SDK 호출 직전 (기존 Toss 경로도 코드 보존) | order_id, amount, currency | `lib/payments/inicis-review-client.ts`, `lib/payments/toss.ts` |
| `checkout_failed` | 주문 생성·SDK 실행 도중 예외; 사용자 취소 포함 가능 | 없음 | `app/(app)/charge/page.tsx` |
| `payment_succeeded` | Toss 승인·크레딧 적립 성공; 이미 승인된 주문 응답에서는 재발행하지 않음 | order_id, amount, credits, currency | `app/api/payments/confirm/route.ts` |
| `payment_failed` | Toss 서버 승인 거절; 클라이언트 취소 화면 방문과 구분 | order_id | 같은 파일 |

`generation_requested`의 클라이언트 시도와 `generation_queued`의 서버 접수는 서로 다른 사건이다. 전환을 비교할 수 있지만 동일한 작업을 직접 조인하려면 서버의 `generation_id`가 있는 이벤트를 사용한다. `elapsed_ms`는 DB 생성부터 최종 상태 갱신까지의 시간으로 큐 대기가 포함된다. `edit_count`는 입력 콜백 횟수이며 관절 수나 독립 편집 작업 수가 아니다.

## 공통 속성과 사용자 식별

- `schema_version=1`, `environment`, `source`, `is_authenticated`, `is_internal`, `is_demo`를 모든 업무 이벤트에 추가한다.
- 브라우저에는 정규화된 `page`와 `is_pose_debug`도 추가한다. `/characters/<id>`는 `/characters/:id`로 기록한다. 쿼리 변경만으로 page_viewed를 추가하지 않는다.
- 익명 방문은 SDK의 디바이스 ID를 사용하고, 로그인 이후 `identify(Supabase user UUID)`로 연결한다. Mixpanel 프로젝트는 **Simplified ID Merge** 설정을 사용한다. 서버도 같은 UUID를 `distinct_id`, `$user_id`로 사용한다.
- 로그아웃·계정 교체 시 SDK `reset()`으로 이전 사용자의 식별을 해제한다. 인증 세션을 확인한 뒤 페이지 이벤트를 보낸다. 이 탭에서 시작한 로그인은 sessionStorage의 시각으로 구분한다.
- 초기 페이지와 캐릭터 모드 진입은 React 개발 모드 effect 재실행으로 중복 기록하지 않는다. 사용자 클릭을 React state updater 안에서 기록하지 않는다.
- 내부 사용자 UUID를 설정하면 `is_internal=true`로 표시한다. 자동 삭제하는 것이 아니라 보고서에서 제외한다. 사용자 UUID 목록은 공개 번들에 포함되므로 비밀 정보로 사용하지 않는다. 이메일은 기록하지 않는다.
- 내부 UUID를 아직 모르면 설정을 비워 둔다. 기존 무료 한도 면제 계정이라고 자동으로 내부 사용자로 간주하지는 않는다.

## 수집 범위

자동 클릭 수집, 자동 페이지 수집, 세션 리플레이, 히트맵, 캔버스 녹화를 끈다. SDK의 자동 원문 URL·리퍼러 속성을 차단한다. 직접 수집하는 리퍼러는 호스트명만, UTM은 source/medium/campaign의 제한된 문자·길이만 허용한다. UTM 값에도 개인정보를 넣지 않는다. SDK는 브라우저·운영체제·화면 크기·디바이스 ID 등 기본 기술 속성을 추가할 수 있다.

프롬프트·캐릭터 이름/설명·이미지/URL·이메일·비밀번호·결제키·오류 원문·포즈 관절 전체값은 이벤트 속성으로 전달하지 않는다. 서버는 실패를 rate_limit/timeout/content_policy/other로 분류한다. IP 기반 위치 분석을 비활성화한다. 이는 수신 서버와의 통신 자체에서 IP가 사라진다는 의미는 아니다.

운영 배포는 외부 수집이 활성화된다. 수집 안내·보관 기간·필요한 동의 처리와 사용자 거부 정책은 서비스 정책에 맞춰 별도로 확정해야 한다. 현재 별도의 동의 UI를 새로 만들지는 않았다.

## 운영 설정과 재정의

추가 자격 증명 없이 `main` push의 Vercel 자동 배포로 연결된다. 현재 로컬 Vercel 로그인은 이 프로젝트 팀의 환경변수 변경 권한이 없어, 공개 토큰만 `next.config.ts`에 두었다. API secret은 필요하지 않으며 코드에 넣지 않는다. 기본값을 바꾸려면 `.env.example`을 참고해 아래 환경변수를 지정한다. NEXT_PUBLIC 값은 빌드 시 고정되므로 변경 후 재빌드/재배포해야 한다. `.env.example`의 개발용 false 설정을 운영에 복사하면 수집이 꺼진다.

```dotenv
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_MIXPANEL_TOKEN=프로젝트_토큰
NEXT_PUBLIC_MIXPANEL_REGION=US
NEXT_PUBLIC_ANALYTICS_ENVIRONMENT=production
NEXT_PUBLIC_ANALYTICS_INTERNAL_USER_IDS=내부_사용자_UUID_1,내부_사용자_UUID_2
```

토큰은 공개 수집용 프로젝트 토큰이며 API secret/service account 비밀번호를 넣으면 안 된다. 리전은 프로젝트가 US면 US, EU면 EU로 맞춘다. 현재 두 리전만 지원한다. 브라우저와 Next 서버에 동일 환경변수를 배포한다. 서버 Track API도 프로젝트 토큰으로 보내므로 별도 서비스 계정은 이 구현에 필요 없다. 개발은 별도 프로젝트를 쓰거나 비활성화한다.

활성화 후 Mixpanel의 이벤트 화면에서 익명 방문 → 로그인 → 생성 → 결과를 확인하고 다음 공통 필터를 적용한다: `environment=production`, `is_internal=false`, `is_demo=false`. 편집 화면 분석에서는 `is_pose_debug=false`도 추가한다. 서버 이벤트에는 디버그 쿼리 정보가 없으므로 디버그 테스트 계정은 내부 UUID로 지정한다.

추천 보고서는 방문/캐릭터 저장/첫 생성 성공 퍼널, 프리셋·다인 포즈·모델 사용률, 생성 성공 후 1일·7일 재생성, 무료 한도 도달 후 충전 페이지/결제 전환이다. 충전 화면은 `page_viewed.page=/charge`로 분석한다. 대시보드 자체의 구성은 Mixpanel 관리 화면 접근 권한이 필요하며 공개 프로젝트 토큰만으로는 만들지 않는다.

## 전송 보장과 현재 한계

브라우저 SDK의 배치 전송은 광고 차단·브라우저 종료 등에 의해 누락될 수 있다. 서버는 1.5초 제한으로 전송하며 실패가 생성/결제 결과를 뒤집지 않도록 격리한다. 라우트 이벤트는 Next `after()`로 응답 뒤 실행하고, 완료 처리 함수는 작업 수명을 보장하기 위해 전송을 await한다. 분석용 별도 outbox나 영구 재전송은 없다.

생성 최종 이벤트는 DB 조건부 갱신으로 전이된 행에만 전송한다. `$insert_id`는 이벤트명+작업/주문 ID로 고정하며 생성 최종 시각도 DB 값을 사용한다. 단, DB 갱신 후 프로세스가 종료되면 이벤트가 유실될 수 있다. 회계/정산 기준은 기존 DB다. 결제 실패는 재승인 시도 단위 집계를 보장하지 않는다.

현재 신규 가입과 기존 OAuth 로그인을 확실히 구별하는 코드가 없어 `signup_completed`는 추가하지 않았다. 생성 이미지 자체의 다운로드 버튼도 없어 `generation_downloaded`를 발행하지 않는다. 현재 있는 포즈 캡처 다운로드와 구분한다. 브라우저가 `/charge/fail`로 돌아오는 취소는 `page_viewed`로 확인하고 서버 승인 거절과 합치지 않는다. 요청 전에 캐릭터가 없어 막힌 경우, 로그인 유도 클릭, 폴링만 시간 초과한 경우는 생성 실패 서버 이벤트로 집계하지 않는다.

## 변경·검증 방법

1. events.ts에 이벤트·속성·설명·locations를 추가한다.
2. 해당 브라우저/서버 어댑터를 정확한 성공 또는 행동 지점에서 호출한다.
3. 위 표와 필요한 보고서 정의를 함께 갱신한다. 기존 이벤트 의미를 바꾸면 이름 또는 schema_version의 호환성을 검토한다.
4. `npm run test:analytics`, `npx tsc --noEmit`, `npm run lint`를 실행한다. 테스트는 원격 Mixpanel에 전송하지 않는다.

참고: [공식 JavaScript SDK](https://github.com/mixpanel/mixpanel-js), [공식 SDK API](https://github.com/mixpanel/mixpanel-js/blob/master/doc/readme.io/javascript-full-api-reference.md), [Next after](https://nextjs.org/docs/app/api-reference/functions/after).
