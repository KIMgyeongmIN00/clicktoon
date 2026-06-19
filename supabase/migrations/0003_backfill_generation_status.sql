-- 0003 — 기존 생성 row 상태 보정.
-- 0002가 status 컬럼을 default 'queued'로 추가하면서, 마이그레이션 이전에 이미 완료된
-- 생성(result_path 있음)이 'queued'로 잘못 표시됐다. result_path가 있으면 완료된 것이므로
-- done으로 보정한다. (idempotent — 재실행 무해)
update public.generations
set status = 'done', error_message = null
where result_path is not null and status <> 'done';
