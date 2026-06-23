-- 0006 — 0005 보정 (Critical).
-- Supabase는 public 스키마 함수의 EXECUTE를 PUBLIC이 아니라 anon/authenticated 역할에
-- "직접" grant한다. 따라서 0005의 `revoke ... from public`은 무효였고, anon/authenticated가
-- 여전히 credit_topup/enqueue_generation 등을 직접 호출할 수 있었다(무한 크레딧).
-- → 해당 역할에서 직접 회수. service_role(서버 serverSupabase)만 실행 가능.

revoke execute on function public.credit_topup(uuid, int, text)
  from public, anon, authenticated;
revoke execute on function public.credit_refund(uuid)
  from public, anon, authenticated;
revoke execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- service_role은 유지 (서버 전용 경로)
grant execute on function public.credit_topup(uuid, int, text) to service_role;
grant execute on function public.credit_refund(uuid) to service_role;
grant execute on function
  public.enqueue_generation(uuid, text, jsonb, text, text, text, uuid, int)
  to service_role;
