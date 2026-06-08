# Pose Toon

캐릭터 레퍼런스 이미지 + 3D 관절 인형 포즈 + 광원 위치를 입력으로 받아
AI 이미지 생성 모델로 같은 캐릭터의 새 포즈 이미지를 만드는 Next.js 앱.

- Next.js 16 (App Router, Turbopack) + TypeScript
- React Three Fiber 기반 절차적 관절 인형 + 광원 핸들
- Supabase Storage + Postgres (이미지/메타 저장)
- 이미지 생성: Google `gemini-3.1-flash-image-preview` (나노바나나2) /
  OpenAI `gpt-image-2` (ducttape)
- 진입은 내부 코드 + localStorage 게이트 (정식 로그인 추후 추가)

## 사전 준비

### 1. 환경변수 (`.env.local`)

```bash
cp .env.example .env.local
```

채워야 하는 값:

| 키 | 설명 |
|---|---|
| `GOOGLE_GEMINI_API_KEY` | Google AI Studio에서 발급 |
| `GOOGLE_IMAGE_MODEL` | 기본 `gemini-3.1-flash-image-preview` |
| `OPENAI_API_KEY` | OpenAI 플랫폼 키 |
| `OPENAI_IMAGE_MODEL` | 기본 `gpt-image-2` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | service role 키 (서버 전용) |
| `NEXT_PUBLIC_ENTRY_CODES` | 진입코드 콤마 리스트 (기본 `alpha-2026,team-prev`) |

### 2. Supabase 스키마

Supabase 프로젝트의 SQL 에디터에 `supabase/migrations/0001_init.sql` 내용을 그대로 붙여 실행.
다음이 생성됨:

- `public.characters` 테이블 (`meta` jsonb 컬럼에 비율/컨셉/성별/태그 저장)
- `public.generations` 테이블 (각 생성 결과)
- `refs`, `results` Storage 버킷 (둘 다 private, 서버에서 signed URL로 노출)
- RLS 활성화 (모든 액세스는 Route Handler가 service role로 처리)

## 개발

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속 → `/enter` 에서 진입코드 입력 → `/characters` 보관함.

## 흐름

1. **`/enter`** — 진입코드 입력. 통과 시 `localStorage["omc:auth-ok"] = "1"`.
2. **`/characters`** — 보관함 그리드. "새 캐릭터" 버튼.
3. **`/characters/new`** — 이미지 드롭 + 메타 입력 → `POST /api/characters` (multipart).
4. **`/characters/[id]`** — 상세 / 편집 / 삭제 / 갤러리.
5. **`/pose/[id]`** — 3D 캔버스. 관절 클릭 또는 사이드바 버튼으로 본 선택 → X/Y/Z 회전 슬라이더.
   광원은 우측 패널 슬라이더 또는 3D 캔버스의 노란 구를 직접 드래그(TransformControls).
   포즈는 `localStorage["omc:pose:char:{id}"]`에 자동 저장.
   "이미지 생성" 클릭 시 캔버스 스냅샷 + 캐릭터 ref + 메타 → `POST /api/generate`.

## 디렉토리

```
app/
  (auth)/enter/        진입코드
  (app)/               EntryGuard로 보호되는 영역
    characters/        보관함 CRUD
    pose/[id]/         포즈 에디터
  api/
    characters/        CRUD + Storage signed URL
    generate/          provider 분기 호출
    generations/[id]/  결과 단건 조회/삭제
components/
  ui/                  Button, Input, Textarea, Label, Card
  characters/          폼, 카드, 이미지 드롭
  pose-editor/         scene, mannequin, bone-panel, light-panel, provider-picker
lib/
  supabase/            server (service role) / browser (anon) 클라이언트
  providers/           google.ts, openai.ts, prompt.ts, index.ts
  pose/storage.ts      localStorage helpers
  auth/                entry, guard
  image/thumbnail.ts   client-side 썸네일 생성
types/                 character.ts, pose.ts (zod)
supabase/migrations/   0001_init.sql
```

## API

| 메서드 / 경로 | 설명 |
|---|---|
| `GET /api/characters` | 전체 목록 + signed URL |
| `POST /api/characters` | 캐릭터 생성 (multipart) |
| `GET /api/characters/[id]` | 단건 + generations 갤러리 |
| `PATCH /api/characters/[id]` | 이름/메타 갱신 |
| `DELETE /api/characters/[id]` | 캐릭터 + Storage + generations 삭제 |
| `POST /api/generate` | 이미지 생성 (`provider`, `poseRenderDataUrl`, `pose`, `extraPrompt`) |
| `GET /api/generations/[id]` | 결과 단건 |
| `DELETE /api/generations/[id]` | 결과 삭제 |

## 한계 / TODO

- 진입코드 검증이 클라이언트 사이드이므로 누구나 우회 가능. 정식 로그인 도입 시 미들웨어 게이트로 격상.
- 관절 인형이 절차적 스틱맨이라 자연스러운 IK 없음. 향후 GLTF 리깅 모델 + IK 솔버 검토.
- 결과 이미지 비용/지연은 provider 응답에 의존.
