-- i18n 마무리 — 지난 분석 리포트의 작성 언어를 기록한다("지난 분석 보기" 목록/상세에
-- 언어 표시용, AI_ANALYSIS.md §5 "재번역 안 함" 결정 참고).

alter table public.analyses add column locale text not null default 'ko';
-- default 'ko'가 백필까지 겸한다 — 이 마이그레이션 이전 생성된 행은 전부 앱이 항상 'ko'를
-- 고정 전송하던 시절의 것이라 실제로도 전부 한국어 리포트다(사실과 일치하는 백필).

-- record_analysis_result에 p_locale 파라미터를 추가한다. Postgres는 파라미터 목록이
-- 다르면 새 오버로드로 취급하므로, 기존 7-인자 시그니처를 명시적으로 지운 뒤 8-인자로
-- 다시 만든다(오버로드 두 개가 같이 남아있는 걸 방지).
drop function if exists public.record_analysis_result(uuid, text, jsonb, jsonb, text, integer, integer);

create or replace function public.record_analysis_result(
  p_user_id uuid,
  p_charge_reason text, -- 'weekly_free'(delta 0, 이번 주 무료 소진 표식) | 'analysis'(delta -1)
  p_records_snapshot jsonb,
  p_report jsonb,
  p_model text,
  p_tokens_in integer,
  p_tokens_out integer,
  p_locale text default 'ko'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_analysis_id bigint;
begin
  if p_charge_reason not in ('weekly_free', 'analysis') then
    raise exception 'invalid charge reason: %', p_charge_reason;
  end if;

  insert into public.credit_events (user_id, delta, reason)
  values (p_user_id, case when p_charge_reason = 'analysis' then -1 else 0 end, p_charge_reason);

  insert into public.analyses (user_id, records_snapshot, report, model, tokens_in, tokens_out, locale)
  values (p_user_id, p_records_snapshot, p_report, p_model, p_tokens_in, p_tokens_out, p_locale)
  returning id into v_analysis_id;

  return v_analysis_id;
end;
$$;

-- 0002와 동일한 이유로 다시 잠근다(새 오버로드는 grant 이력이 없어야 정상이지만,
-- Postgres 기본 동작을 신뢰하지 않고 매번 명시적으로 확인 — CLAUDE.md 지뢰 목록 참고).
revoke execute on function public.record_analysis_result(uuid, text, jsonb, jsonb, text, integer, integer, text) from public;
