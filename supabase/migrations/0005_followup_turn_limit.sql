-- AI_ANALYSIS.md §8 — 후속 질문 상한을 3 → 10으로 상향(2026-07-17 원가 실측 근거,
-- STATUS.md 참고). 유료 연장 상품은 만들지 않기로 했다(원가 18~26원짜리를 1,000원에
-- 파는 상품은 안 팔리고 Play 등록 부담만 늘어남) — 대신 무료 상한 자체를 올린다.
--
-- append_followup_turn의 WHERE 절(`followup_turns_used < 3`)이 턴 초과 방지의 유일한
-- 원자적 강제 지점이라 여기서만 숫자를 바꾸면 된다. CREATE OR REPLACE FUNCTION은 같은
-- 시그니처를 유지하는 한 소유권/권한(0003의 revoke/grant)을 그대로 보존하므로 재부여
-- 불필요.
create or replace function public.append_followup_turn(
  p_analysis_id bigint,
  p_user_id uuid,
  p_new_turns jsonb, -- 이번 턴에 추가되는 [{role, content}, ...] (사용자 질문 + 어시스턴트 응답)
  p_tokens_in integer,
  p_tokens_out integer
)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turns_used smallint;
begin
  update public.analyses
    set turns = turns || p_new_turns,
        followup_turns_used = followup_turns_used + 1,
        tokens_in = coalesce(tokens_in, 0) + p_tokens_in,
        tokens_out = coalesce(tokens_out, 0) + p_tokens_out
    where id = p_analysis_id
      and user_id = p_user_id
      and followup_turns_used < 10
    returning followup_turns_used into v_turns_used;

  if v_turns_used is null then
    raise exception 'analysis not found, not owned by caller, or turn limit reached' using errcode = 'P0001';
  end if;

  return v_turns_used;
end;
$$;

-- 기존에 3턴을 소진한 analyses 행은 마이그레이션 없이도 자연히 7턴이 더 열린다 —
-- followup_turns_used는 그대로 두고 상한 판정만 바뀌므로 별도 데이터 갱신 불필요.
