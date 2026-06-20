# SDD — 비동기 AI 생성 파이프라인 & 인증/크레딧

> 상태: **v0.2 — 핵심 결정 확정(D1~D4), Phase A 착수 가능** · 일부 Phase C 항목 OPEN
> 범위: 동기 `/api/generate` → 비동기(Trigger.dev) 파이프라인 전환, 결과 전달, 실패 처리, 인증(Google OAuth), 서버 크레딧.

확정 스택: **Trigger.dev 클라우드(실행) + HMAC 콜백(Next가 유일 DB 작성자) + 폴링(MVP) + 트랜잭션 outbox + idempotencyKey**.

---

## 1. 목표 & 비목표
**목표**: 긴 AI 생성을 요청 경로에서 분리 · Next.js API Router = 백엔드/유일 DB 작성자 · 실패를 row에 기록해 UI 노출 · 결과는 Supabase Storage 경로 · 로그인(Google OAuth)+서버 크레딧.
**비목표**: 실시간 협업, 토스 웹훅 정산(후속).

## 2. 현재 상태 (동기)
`POST /api/generate`가 한 요청에서 ref 다운로드→AI 어댑터(`lib/providers/*`)→Storage 업로드→`generations` insert→`result_url` 반환(`maxDuration=60`). 길어지면 타임아웃 위험·클라 대기.

---

## 3. 타깃 아키텍처 (확정)

```
Client ──POST /api/generate──▶ Next.js API Router  [유일 DB/Storage 권한자]
                                 (1 TX) generations row(queued) + outbox(pending)
                                        + 크레딧 예약 차감
                                 enqueue: tasks.trigger(idempotencyKey=genId,
                                          payload={presigned GET(ref), presigned PUT(result), pose, prompt})
                                 ◀─ 202 { generationId }

Trigger.dev Cloud  [순수 실행기 — DB/장기 Storage 키 없음]
   consume ▶ ref GET(presigned) ▶ AI 생성(Gemini/OpenAI) ▶ result PUT(presigned)
           ▶ HMAC 콜백 POST /api/generations/:id/callback {status, result_path | error}

Next callback ▶ HMAC+role 검증 ▶ 멱등 finalize(상태전이 가드) ▶ row(done/failed) + 크레딧 확정/환불

Client ◀── 폴링 GET /api/generations/:id (status=done/failed까지)   // 후속: Supabase Realtime
```

핵심: **task는 DB도 장기 Storage 키도 안 가짐.** Next가 enqueue 시 발급한 **presigned URL**로만 ref를 읽고 result를 올림 → "Next = 유일 DB/Storage 작성자" 원칙 엄수(D2-B).

---

## 4. 핵심 결정 (확정)

### D1. 인프라 = **Trigger.dev 클라우드** ✅
- 매니지드 MicroVM. SQS·워커호스트·자동스케일 대체. 2분·1000건/월 ≈ $4.
- `maxDuration: timeout.None` (CPU시간 기준, AI 작업 안 끊기게). **`TIMED_OUT`엔 `onFailure` 미호출** → backstop reaper로 보완(D5).
- 트리거: `TRIGGER_SECRET_KEY`(서버), `tasks.trigger<typeof task>("generate-image", payload, { idempotencyKey, concurrencyKey, queue })`.
- 교체 가능성: `JobQueue` 인터페이스(§6)로 추상화 → 추후 셀프호스트/SQS 회귀 비용 격리.

### D2. DB 쓰기 경계 = **HMAC 콜백 유지(원안 #3)** ✅
- task는 AI + result 업로드(presigned)만. 완료/실패 시 **HMAC 서명+role**로 `POST /api/generations/:id/callback` → **Next만 row 작성**(§7).
- 비즈니스 로직(상태전이·크레딧 확정/환불)은 콜백 핸들러 한 곳에 집중.

### D3. 결과 수신 = **폴링(MVP)** ✅, 추후 Realtime
- `GET /api/generations/:id` 주기 폴링(예: 2s, 지수백오프, done/failed에서 종료).
- 후속 업그레이드: **Supabase Realtime**(generations row 구독) — 코드 격리해 전환 쉽게.

### D4. 멱등/신뢰 enqueue = **트랜잭션 outbox + idempotencyKey** ✅ (원안 #4)
- enqueue: 1 TX 안에서 `generations(queued)` + `outbox(pending)` insert. relay가 outbox pending을 읽어 `tasks.trigger(idempotencyKey=genId)` 후 `sent` 표시 → API 핸들러가 죽어도 run 보장.
- idempotencyKey(=genId, TTL 30일, 실패 시 자동해제)로 재전송 중복 run 방지.
- 콜백 멱등: 상태가 `queued/processing`일 때만 수용 → `done/failed` 전이(중복 콜백 무시). 크레딧은 `credit_ledger UNIQUE(reason,ref)`로 이중 차감/환불 방지.

### D5. 타임아웃 & 실패 (원안 #5, #8) ✅
- `maxDuration: timeout.None`. task 실패(재시도 소진) → `onFailure`에서 콜백 `{status:failed,error}`.
- **Backstop reaper**: `status in (queued,processing) and updated_at < now()-30min` → `failed`(timeout) + 환불. Trigger.dev `schedules`(cron) 또는 Supabase `pg_cron`. 너의 "30분 유실→실패" 안전망.

---

## 5. 데이터 모델

### 5.1 `generations` 마이그레이션 (Phase A)
```sql
alter table public.generations
  alter column result_path drop not null,
  alter column model drop not null,
  add column status text not null default 'queued'
    check (status in ('queued','processing','done','failed')),
  add column error_message text,
  add column owner uuid,
  add column idempotency_key text unique,
  add column attempts int not null default 0,
  add column updated_at timestamptz not null default now();
create index generations_status_idx on public.generations(status, updated_at);
create index generations_owner_idx on public.generations(owner, created_at desc);
```

### 5.2 `outbox` (Phase A/B)
```sql
create table public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index job_outbox_pending_idx on public.job_outbox(status, created_at) where status='pending';
```

### 5.3 인증 (Supabase Google OAuth, Phase C — 원안 #9)
- Supabase Auth Google provider → `auth.users`. `characters.owner`/`generations.owner` = `auth.uid()`.

### 5.4 크레딧 & 원장 (Phase C)
```sql
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  delta int not null, reason text not null, ref text,
  created_at timestamptz not null default now(),
  unique (reason, ref)               -- 멱등: 중복 차감/환불 방지
);
```
- 충전: 토스 승인 성공 → `ledger(+credits,'topup',paymentKey)` + balance.
- 차감: **enqueue 시 예약(-N) → 실패/유실 시 환불(+N)**. 현 localStorage 크레딧은 테스트 전용 → 로그인 시 서버 이관.

### 5.5 RLS
- 로그인 후: read `owner = auth.uid()`(폴링/추후 Realtime용), write는 service role(서버)만. `credit_ledger`/`job_outbox`는 서버 전용.

---

## 6. 코드 구조
```
lib/jobs/queue.ts                 # JobQueue 인터페이스 (enqueue/relay)
lib/jobs/trigger.ts               # Trigger.dev 구현
trigger/generate-image.ts         # task: presigned GET→AI→presigned PUT→HMAC 콜백
lib/storage/presign.ts            # ref GET / result PUT presigned URL 발급
lib/generation/finalize.ts        # 콜백 finalize(상태전이+크레딧) 단일 로직
app/api/generate/route.ts                 # enqueue only (TX: row+outbox+예약)
app/api/generations/[id]/route.ts         # 단건 조회(폴링)
app/api/generations/[id]/callback/route.ts# HMAC+role 검증 콜백 → finalize
lib/jobs/reaper.ts                # backstop 30분 reaper (scheduled)
```
Phase A에선 `lib/jobs/trigger.ts` 대신 **인프로세스 스텁**으로 enqueue→콜백 흐름을 먼저 검증.

## 7. 콜백 인증 (D2-B 확정 — 원안 #3)
- 워커→`POST /api/generations/:id/callback`, 헤더: `X-Signature: hex(HMAC_SHA256(rawBody, WORKER_CALLBACK_SECRET))`, `X-Worker-Role: worker`, `X-Timestamp`.
- Next: ① rawBody로 HMAC 재계산·상수시간 비교 ② role 화이트리스트 ③ timestamp 허용윈도우(재생공격) ④ `generationId` 상태 `queued/processing`일 때만 수용 ⑤ `done/failed` 전이 + 크레딧 확정/환불. 시크릿은 Next·Trigger env에만.

## 8. 시퀀스
**해피**: /api/generate → TX(row queued + outbox + 예약 -N) → 202 → relay trigger → task(ref GET→AI→result PUT)→ HMAC 콜백(done,result_path) → finalize → 폴링이 done 수신.
**실패**: task 에러→재시도 소진→onFailure 콜백(failed,error) → finalize(failed)+환불 → 폴링이 failed 수신. / 유실(콜백 없음 30분)→reaper failed+환불.

## 9. 실패 → UI (원안 #5)
`status='failed'`+`error_message` 노출. 생성 패널/갤러리에 실패 카드 + "다시 시도" + (환불 시) "크레딧 환불" 안내. 메시지 매핑은 `lib/providers/retry.ts` 재사용.

## 10. 단계별 계획
- **Phase A (인프라 무관)**: §5.1·§5.2 마이그레이션, `JobQueue` + 인프로세스 스텁, `/api/generate` enqueue화(TX+outbox), 단건 조회, 폴링 클라 전환, 실패 UI. → Trigger 없이 비동기 계약 검증.
- **Phase B (Trigger.dev)**: `trigger/generate-image.ts` task, providers 이관, presigned 발급, HMAC 콜백, `maxDuration:None`, reaper.
- **Phase C (인증/크레딧)**: Google OAuth, `wallets`/`credit_ledger`, 예약/환불, RLS, localStorage→서버.

## 11. Phase C 상세 설계 (확정)

확정 결정: **개인 계정(로그인 필수) · 예약 차감+환불 · 기존 owner=null 데모 숨김.**

### 11.1 인증 — Supabase Google OAuth (로그인 필수)
- `@supabase/ssr` 3요소: 브라우저 client, 세션 server client(쿠키 기반), `middleware.ts`(요청마다 세션 갱신).
- `/login`("Continue with Google" → `signInWithOAuth({provider:'google', redirectTo:/auth/callback})`), `app/auth/callback/route.ts`(`exchangeCodeForSession`→쿠키→리다이렉트), 로그아웃.
- 게이트: `(app)` 그룹은 세션 없으면 `/login`으로(middleware). **로그인해야 캐릭터/생성/갤러리 사용.**
- 서버 라우트는 client 2종: ① 세션 client(`auth.uid()` 확인) ② service-role client(특권 쓰기 — 기존 `lib/supabase/server.ts`).
- ⚠️ 외부 설정(사용자): Supabase 대시보드 Auth → **Google provider 활성화**(Google Cloud OAuth client ID/secret 등록).

### 11.2 데이터 스코핑 — per-user
- `generations.owner`/`characters.owner` = `auth.uid()`. 라우트가 owner로 필터(service-role이라 RLS 우회 → 코드에서 `.eq("owner", uid)`).
- 기존 `owner=null` 데모는 owner 필터로 **자연히 숨겨짐**(삭제 불필요; 원하면 정리 마이그레이션 옵션).
- 캐릭터 생성/목록·갤러리 전부 owner 스코프.

### 11.3 크레딧 스키마 + 원자적 RPC
- `wallets`, `credit_ledger`(§5.4). `auth.users` insert 트리거로 wallet 자동 생성(balance 0).
- RPC(security definer, 트랜잭션 원자성):
  - **`enqueue_generation` 확장** → `balance >= cost` 확인 + **예약 차감**(ledger -cost,'generation',genId) + row+outbox 생성. 부족 시 예외 → 라우트 402.
  - **`credit_topup(user, amount, ref)`** → +적립(unique 'topup',paymentKey 멱등). `/api/payments/confirm`에서 호출.
  - **`credit_refund(generation_id)`** → 해당 'generation' 원장 금액을 환불(+,'refund',genId; unique로 이중환불 방지). 실패 콜백·reaper에서 호출.

### 11.4 흐름 변경
- **enqueue**: 세션 확인(없으면 401) → cost 계산 → 확장 `enqueue_generation`(예약 포함) → trigger. 부족 시 **402 "크레딧 부족" → 충전 유도**.
- **실패/유실**: failed 콜백·reaper에서 `credit_refund(genId)`.
- **충전**: `/api/payments/confirm`가 세션 유저에 `credit_topup`. 클라 `addCredits`(localStorage) 제거.
- **잔액**: `GET /api/wallet`(세션)→balance. nav/charge/me가 서버 잔액 표시(추후 Supabase Realtime on wallets).

### 11.5 RLS
- read = `owner/user_id = auth.uid()`(generations/characters/wallets/credit_ledger). `job_outbox` 서버 전용. 쓰기 service-role. 라우트는 당분간 service-role+owner필터, RLS는 방어·추후 Realtime용.

### 11.6 정리/이관
- `lib/credits/store.ts`(localStorage) 폐기, `useCredits`→서버 fetch. 충전이 서버 지갑으로 이관됨.

### 11.7 서브 단계
- **C1** 인증 플러밍(+대시보드 Google provider) → **C2** 크레딧 스키마/RPC 마이그레이션 → **C3** 와이어링(예약/환불/충전 서버화/owner 스코프/잔액 서버 표시).

## 12. 참고 (Trigger.dev v4, 2026-06)
v4 GA/Apache-2.0/클라우드+셀프호스트 · `maxDuration`=CPU시간(기본60s, `timeout.None` 무제한, TIMED_OUT엔 onFailure 미호출) · 내장 큐/`concurrencyKey` · 재시도(3)+`idempotencyKey`(TTL30일) · `useRealtimeRun`/`onFailure` · `TRIGGER_SECRET_KEY`. 출처: trigger.dev/docs (max-duration, queue-concurrency, idempotency, errors-retrying, realtime, pricing).
