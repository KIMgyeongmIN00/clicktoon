// 시연용 임시 데이터 시드.
// 로그인한 계정에 데모 캐릭터 1개 + 갤러리 샘플 2개(done)를 넣어
// 시연 시작 상태가 비어 있지 않게 한다. 실제 AI 호출 없음(지정 이미지 사용).
//
// 사용법:
//   node --env-file=.env.local scripts/seed-demo.mjs               # 가장 최근 가입 계정에 시드
//   node --env-file=.env.local scripts/seed-demo.mjs you@mail.com  # 특정 이메일 계정에 시드
//   node --env-file=.env.local scripts/seed-demo.mjs --reset       # 데모 데이터 삭제 후 재시드
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const DEMO_CHAR_NAME = "데모 캐릭터 (시연)";
const arg = process.argv[2];
const reset = process.argv.includes("--reset");
const email = arg && !arg.startsWith("--") ? arg : null;

function assetPath(f) {
  return path.join(process.cwd(), "public", "demo", f);
}
function upload(bucket, p, file, mime = "image/png") {
  return sb.storage
    .from(bucket)
    .upload(p, readFileSync(assetPath(file)), { contentType: mime, upsert: true });
}

// 1) 대상 유저 확인
const { data: list, error: uErr } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (uErr) {
  console.error("유저 조회 실패:", uErr.message);
  process.exit(1);
}
const users = list.users ?? [];
const user = email
  ? users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  : users.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
if (!user) {
  console.error(
    email
      ? `이메일 '${email}' 계정을 찾을 수 없어요. 먼저 그 계정으로 로그인하세요.`
      : "가입한 계정이 없어요. 먼저 앱에서 한 번 로그인한 뒤 다시 실행하세요.",
  );
  process.exit(1);
}
console.log(`대상 계정: ${user.email ?? user.id}`);

// 선택: 기존 데모 데이터 정리
if (reset) {
  const { data: olds } = await sb
    .from("characters")
    .select("id")
    .eq("owner", user.id)
    .eq("name", DEMO_CHAR_NAME);
  for (const c of olds ?? []) {
    await sb.from("generations").delete().eq("character_id", c.id);
    await sb.from("characters").delete().eq("id", c.id);
  }
  if (olds?.length) console.log(`기존 데모 캐릭터 ${olds.length}개 삭제`);
}

// 2) 데모 캐릭터 (char-ref.png → refs)
const uid8 = user.id.slice(0, 8);
const refPath = `demo-${uid8}/ref.png`;
const ru = await upload("refs", refPath, "char-ref.png");
if (ru.error) {
  console.error("ref 업로드 실패:", ru.error.message);
  process.exit(1);
}
const ins = await sb
  .from("characters")
  .insert({
    owner: user.id,
    name: DEMO_CHAR_NAME,
    ref_path: refPath,
    meta: {
      gender: "여성",
      outfit: "캐주얼 후드",
      mainConcept: "밝고 활기찬 대학생 캐릭터",
      features: "갈색 단발, 큰 눈",
    },
  })
  .select("id")
  .single();
if (ins.error) {
  console.error("캐릭터 생성 실패:", ins.error.message);
  process.exit(1);
}
const characterId = ins.data.id;
await sb.from("character_assets").insert({
  character_id: characterId,
  owner: user.id,
  kind: "front",
  path: refPath,
  sort: 0,
});
console.log(`데모 캐릭터 생성: ${characterId}`);

// 3) 갤러리 샘플 2개 (pose-a/b → results, status done)
const samples = [
  { file: "pose-a.png", provider: "google" },
  { file: "pose-b.png", provider: "openai" },
];
for (const [i, s] of samples.entries()) {
  const rp = `${characterId}/demo-${i}.png`;
  const up = await upload("results", rp, s.file);
  if (up.error) {
    console.error("결과 업로드 실패:", up.error.message);
    continue;
  }
  const g = await sb
    .from("generations")
    .insert({
      character_id: characterId,
      owner: user.id,
      provider: s.provider,
      model: "demo",
      prompt: "demo render (시연 시드)",
      pose: {},
      kind: "pose",
      status: "done",
      result_path: rp,
    })
    .select("id")
    .single();
  if (g.error) console.error("생성 행 삽입 실패:", g.error.message);
  else console.log(`갤러리 샘플 ${i + 1} 삽입: ${g.data.id}`);
}

console.log("\n✅ 시드 완료. 앱에서 해당 계정으로 접속하면 데모 캐릭터·갤러리가 보입니다.");
