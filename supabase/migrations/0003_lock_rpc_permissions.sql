-- 0002의 REVOKE EXECUTE ... FROM public이 충분하지 않았다 — Supabase는 새 함수에
-- anon/authenticated 롤한테 PUBLIC과 별개로 직접 EXECUTE를 부여해둔다(ALTER DEFAULT
-- PRIVILEGES로 RPC가 기본 동작하게 하기 위함). 실증: anon 클라이언트가
-- record_analysis_result를 직접 호출했을 때 "권한 없음"이 아니라 balance check
-- 제약 위반으로 실패함 — 즉 함수 자체는 실행됐다는 뜻. anon/authenticated에서
-- 명시적으로 걷어낸다.
revoke execute on function public.record_analysis_result(uuid, text, jsonb, jsonb, text, integer, integer) from anon, authenticated;
revoke execute on function public.append_followup_turn(bigint, uuid, jsonb, integer, integer) from anon, authenticated;
revoke execute on function public.has_weekly_free(uuid) from anon, authenticated;
revoke execute on function public.week_start_kst(timestamptz) from anon, authenticated;

-- Edge Function은 secret key(service_role)로 연결하므로 여기에만 명시적으로 허용한다.
grant execute on function public.record_analysis_result(uuid, text, jsonb, jsonb, text, integer, integer) to service_role;
grant execute on function public.append_followup_turn(bigint, uuid, jsonb, integer, integer) to service_role;
grant execute on function public.has_weekly_free(uuid) to service_role;
grant execute on function public.week_start_kst(timestamptz) to service_role;
