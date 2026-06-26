# AI 생성 파이프라인 — 큐 메시징 기반 신뢰성·순서성

> 대상: 현재 구현된 비동기 AI 이미지 생성 파이프라인의 기술 설명.
> 핵심: 생성 job을 큐로 처리하면서 **at-least-once 전달**을 **멱등성 + 상태기계 + 트랜잭션 outbox + backstop reaper**로 보정해 신뢰성을 확보하고, **per-job 생명주기 순서**를 보장한다. (설계 의사결정은 `SDD-ai-generation-pipeline.md` 참고)

---

## 1. 개요

AI 이미지 생성은 수초~수분 걸리는 장시간 작업이라 HTTP 요청 경로에서 분리한다. 실행은 **Trigger.dev**(큐·run 오케스트레이션·재시도) 워커가 맡고, **Next.js API Router가 유일한 DB 작성자**다. 워커는 결과를 Next에 **HMAC 서명 콜백**으로 돌려주고, Next가 row를 확정한다.

```
Client ─POST /api/generate─▶ Next (1 TX: row+outbox+크레딧 예약) ─202 {generationId}
                              │ tasks.trigger(idempotencyKey=generationId)
                              ▼
                         Trigger.dev (큐·동시성·재시도)
                              │ 실행
                         Worker(task) ─ presigned GET/PUT(Storage) ─ AI 생성
                              │ HMAC 콜백(서명=generationId 바인딩)
                              ▼
                         Next /callback ─ 멱등 finalize(done|failed) + 크레딧 확정/환불
Client ◀─ 폴링 GET /api/generations/:id (done|failed까지)
30분 reaper(cron) ─ 콜백 없이 멈춘 job → failed + 환불
```

---

## 2. 구성요소

| 구성요소 | 파일 | 역할 |
|---|---|---|
| enqueue | `app/api/generate/route.ts` | 세션 확인 → 입력 렌더 업로드 → `enqueue_generation` RPC → `tasks.trigger` |
| 원자적 enqueue RPC | `supabase/migrations/0004,0005` `enqueue_generation` | **1 트랜잭션**: `generations`(queued) + `job_outbox`(pending) + 크레딧 예약 차감 |
| 큐 어댑터 | `lib/jobs/trigger.ts` (`makeTriggerQueue`) | row→presigned 페이로드 구성 → `tasks.trigger(idempotencyKey=generationId)` |
| 워커 task | `trigger/generate-image.ts` | presigned로 입력 읽고 AI 호출, 결과 presigned 업로드, HMAC 콜백 (DB·장기키 없음) |
| 콜백 | `app/api/generations/[id]/callback/route.ts` | HMAC+role+timestamp+**generationId 바인딩** 검증 → finalize |
| 상태 전이 | `lib/generation/finalize.ts` | `markProcessing/markDone/markFailed` — 비종료 상태에서만 전이(멱등) |
| reaper | `app/api/jobs/reap/route.ts` + `trigger/reaper.ts`(cron */10) | 30분+ 멈춘 job → failed + 환불 |
| 크레딧 원장 | `credit_ledger` (`UNIQUE(reason, ref)`) | 예약/환불 멱등 보장 |
| 폴백 스텁 | `lib/jobs/stub.ts` | `TRIGGER_SECRET_KEY` 없을 때 인프로세스 실행(개발용) |

---

## 3. Job 생명주기 (상태기계)

`generations.status`: **`queued` → `processing` → `done` | `failed`**

- `queued`: enqueue 직후. row·outbox·크레딧 예약이 커밋된 상태.
- `processing`: 워커가 집어 처리 시작(`markProcessing`, `queued`→`processing`만 허용).
- `done`: 결과 업로드 후 콜백(`markDone`). `result_path`·`model`·`prompt` 채움.
- `failed`: 워커 에러(재시도 소진) 콜백 또는 reaper. `error_message` 채움 + 크레딧 환불.

**전이는 단방향·멱등**: 모든 전이가 `status in (queued, processing)`인 row만 갱신한다(`.in("status", [...])`). 종료 상태(done/failed)는 다시 바뀌지 않으므로, **중복·지연 콜백은 자동 no-op**이 된다.

---

## 4. 신뢰성 보장

큐 전달은 **at-least-once**(메시지가 1번 이상 전달될 수 있음)를 전제로 설계한다. 아래 장치들이 "정확히 한 번 처리된 효과"를 만든다.

1. **원자적 enqueue (트랜잭션 outbox)** — `enqueue_generation` RPC가 `generations`(queued) + `job_outbox`(pending) + 크레딧 예약을 **한 트랜잭션**으로 커밋. → "row는 있는데 차감 안 됨" / "차감했는데 row 없음" 같은 부분 상태가 불가능.

2. **enqueue 멱등** — `tasks.trigger(..., { idempotencyKey: generationId })`. 같은 키로 재트리거하면 Trigger.dev가 **기존 run 핸들을 반환**(새 run 안 만듦). 추가로 `generations.idempotency_key`에 `UNIQUE` — RPC가 같은 키면 기존 generation id 반환. → 클라 중복 제출/재시도에도 단일 job.

3. **상태 전이 멱등** — §3. 콜백이 중복·지연 도착해도 종료 상태면 무시. → at-least-once 콜백에 안전.

4. **크레딧 멱등** — `credit_ledger`의 `UNIQUE(reason, ref)`. 예약은 `('generation', generationId)`, 환불은 `('refund', generationId)`, 충전은 `('topup', paymentKey)`로 한 번씩만. → 중복 콜백이 이중 차감/환불/적립을 못 함.

5. **재시도** — Trigger.dev task `retry`(기본 2~3회, 지수 백오프)로 일시적 실패(네트워크·업스트림 5xx) 자동 재시도. 소진되면 `onFailure` 1회 → failed 콜백.

6. **HMAC 콜백 인증** — 워커만 row를 확정할 수 있게 `HMAC-SHA256(서명 대상 = generationId.timestamp.body)` + role + timestamp 윈도우(5분) 검증. **서명에 generationId를 바인딩**해 한 job의 콜백을 다른 job에 재사용 불가. → 위조·재생·cross-resource 공격 차단.

7. **backstop reaper** — Trigger.dev는 `TIMED_OUT` 시 `onFailure`를 호출하지 않는다. 워커 사망·타임아웃·콜백 유실로 30분+ `queued/processing`에 멈춘 job을 cron(`*/10`)이 `failed` + 환불 처리. → "영원히 멈춘 job + 묶인 크레딧" 방지. (`result_path` 있는 row는 가드로 제외)

### enqueue 후 trigger 실패 시
RPC 커밋(row queued + 예약) **후** `tasks.trigger()`가 실패하면 run이 안 생긴다. 이 job은 `queued`로 남고 → **reaper가 30분 뒤 failed + 환불**한다. 즉 유실돼도 사용자는 결국 환불받는다.

---

## 5. 순서성 (Ordering) & 동시성

- **per-job 생명주기 순서**는 상태기계(§3)가 강제한다. 콜백이 뒤섞여 와도 종료 상태가 일관된다(done 이후 failed로 안 뒤집힘).
- **job 간 전역 순서는 요구하지 않는다.** 각 생성은 독립(자기 generationId·run). 이미지 생성은 서로 의존이 없어 FIFO가 불필요하다.
- **동시성 제어**: Trigger.dev는 task마다 큐 + 동시성 한도를 제공한다. 현재는 기본 큐를 쓰며 per-user 격리는 미설정 — 필요 시 `tasks.trigger(..., { concurrencyKey: userId })`로 "유저별 동시 실행 N개" 격리 가능(한 유저가 큐를 독점하지 않게).
- **outbox의 순서 보존**: `job_outbox`는 `created_at` 순서로 enqueue 의도를 보존한다(아래 한계 참고).

---

## 6. 실패 모드 대응표

| 실패 모드 | 대응 장치 | 결과 |
|---|---|---|
| 클라 중복 제출/재시도 | idempotencyKey + `idempotency_key` UNIQUE | 단일 job |
| 콜백 중복/지연 도착 | 상태 전이 멱등 + ledger UNIQUE | no-op, 이중 차감/환불 없음 |
| 일시적 업스트림 오류 | Trigger.dev 재시도 | 자동 재시도 후 성공 또는 failed |
| 워커 에러(재시도 소진) | `onFailure` → failed 콜백 | failed + 환불 + UI 노출 |
| 워커 사망 / `TIMED_OUT` / 콜백 유실 | 30분 reaper | failed + 환불 |
| `tasks.trigger` 실패 | row=queued 잔류 → reaper | failed + 환불 |
| 콜백 위조/재생 | HMAC(generationId 바인딩)+timestamp | 401 거부 |

---

## 7. 현재 한계 / 하드닝 백로그

솔직한 현황 — 신뢰성의 1차 방어는 "동기 `tasks.trigger` + idempotencyKey + reaper"이고, outbox는 아직 **기록(감사·원자성)** 용도에 가깝다.

- **outbox relay 미구현(Trigger 경로)**: 인프로세스 스텁은 처리 후 `job_outbox`를 `sent`로 마킹하지만, **Trigger 경로는 outbox를 sent로 마킹하거나 pending을 재전송하는 relay가 없다.** 현재는 enqueue 요청에서 `tasks.trigger`를 동기 호출하고, 실패 시 reaper로 회수한다. → 진짜 outbox 패턴(별도 relay가 pending을 polling해 재전송)으로 강화하면 "트리거 호출 유실"도 자동 복구된다.
- **per-user concurrencyKey 미설정**: 한 유저가 다수 job을 동시에 던지면 공용 큐를 점유할 수 있다. `concurrencyKey: userId` + 한도로 격리 권장.
- **processing 상태 핑 없음**: Trigger 경로는 `queued → done`으로 가고 `processing`을 안 거친다(워커가 시작 시 별도 ping 안 함). UI가 "대기 중"으로만 보인다. task `onStart` 훅에서 processing 콜백을 추가하면 진행 표시가 정확해진다.
- **DLQ 없음**: 재시도 소진은 `failed`로 종료된다(독성 메시지 무한루프는 없음). 별도 dead-letter 보관/재처리 큐는 미구현.

---

## 8. 코드 맵

- enqueue: `app/api/generate/route.ts`
- 원자적 RPC: `supabase/migrations/0004_credits.sql`, `0005_credit_rpc_security.sql` (`enqueue_generation`)
- 큐 인터페이스/구현: `lib/jobs/queue.ts`, `lib/jobs/trigger.ts`, `lib/jobs/stub.ts`
- task: `trigger/generate-image.ts`, `trigger/reaper.ts`, `trigger.config.ts`
- 콜백/폴링: `app/api/generations/[id]/callback/route.ts`, `app/api/generations/[id]/route.ts`
- reaper: `app/api/jobs/reap/route.ts`
- 상태 전이: `lib/generation/finalize.ts`
- HMAC: `lib/crypto/hmac.ts`
- presigned: `lib/storage/presign.ts`
- 크레딧: `lib/credits/cost.ts`, `credit_ledger`/`wallets` (0004)
