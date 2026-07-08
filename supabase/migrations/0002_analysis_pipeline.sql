-- Phase B — AI_ANALYSIS.md §5 파이프라인용 원장/이력 확장.
-- 0001의 함수들(has_weekly_free, week_start_kst, apply_credit_event, handle_new_auth_user)이
-- Postgres 기본 동작대로 PUBLIC(anon/authenticated 포함)에게 EXECUTE 권한이 열려 있었다 —
-- 여기서 함께 잠근다(발견 즉시 수정 원칙).

alter table public.analyses add column turns jsonb not null default '[]'::jsonb;
-- turns: 후속 질문 대화 이력 [{role, content}, ...]. 최초 리포트는 report 컬럼에,
-- 후속 3턴은 여기 append된다 — 다음 턴 호출 시 컨텍스트로 재사용.

-- 성공 후 차감(= 크레딧 원장 로직의 핵심 판단): Claude 호출 "전" 예약 후 실패 시 환급하는
-- 방식 대신, 호출이 성공한 뒤에만 credit_events insert + analyses insert를 한 트랜잭션으로
-- 묶는다. 이유: 예약→환급 방식은 "환급 자체가 실패"하면 사용자가 서비스 없이 차감만
-- 당하는 상태가 남는다(AI_ANALYSIS.md §8 "실패 시 크레딧 미차감" 요구사항 위반 가능성).
-- 성공 후 차감은 그런 보상 트랜잭션이 아예 필요 없다 — 이 함수 자체가 실패하면(레이스로
-- balance check 위반 등) 두 insert가 함께 롤백되므로 "일부만 반영"되는 상태가 없다.
-- 대가: 동시 요청 레이스에서 극히 드물게 Claude 호출 비용은 이미 지불했는데 이 함수가
-- 실패하는 경우가 있다(같은 유저가 동시에 2번 분석 요청 + 잔액 1개뿐인 극단 케이스) —
-- 그 비용은 감수한다(발생 빈도 낮고 건당 비용 작음, "충전 없이 서비스 제공"보다 안전).
create or replace function public.record_analysis_result(
  p_user_id uuid,
  p_charge_reason text, -- 'weekly_free'(delta 0, 이번 주 무료 소진 표식) | 'analysis'(delta -1)
  p_records_snapshot jsonb,
  p_report jsonb,
  p_model text,
  p_tokens_in integer,
  p_tokens_out integer
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

  insert into public.analyses (user_id, records_snapshot, report, model, tokens_in, tokens_out)
  values (p_user_id, p_records_snapshot, p_report, p_model, p_tokens_in, p_tokens_out)
  returning id into v_analysis_id;

  return v_analysis_id;
end;
$$;

-- 후속 질문은 크레딧 차감이 없다(분석 1회 = 리포트 + 후속 3턴 포함, AI_ANALYSIS.md §2).
-- WHERE 절의 followup_turns_used < 3이 "3턴 초과 방지"의 원자적 강제 지점 — 동시 요청이
-- 와도 세 번째 이후는 여기서 걸린다(UPDATE가 0행 반영 → returning 값 null).
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
      and followup_turns_used < 3
    returning followup_turns_used into v_turns_used;

  if v_turns_used is null then
    raise exception 'analysis not found, not owned by caller, or turn limit reached' using errcode = 'P0001';
  end if;

  return v_turns_used;
end;
$$;

-- 함수 실행 권한: Postgres는 기본적으로 새 함수의 EXECUTE를 PUBLIC(anon/authenticated 포함)에
-- 열어둔다. 이 두 함수는 크레딧/분석 이력을 직접 조작하므로 Edge Function(secret key,
-- service_role)에서만 호출 가능해야 한다 — 클라이언트가 RPC를 직접 불러 크레딧을 위조하는
-- 경로를 차단.
revoke execute on function public.record_analysis_result(uuid, text, jsonb, jsonb, text, integer, integer) from public;
revoke execute on function public.append_followup_turn(bigint, uuid, jsonb, integer, integer) from public;

-- 0001에서 놓친 부분: has_weekly_free/week_start_kst도 기본적으로 PUBLIC executable이었다.
-- 위험도는 낮지만(읽기 전용, 최악의 경우 "이 uuid가 이번 주 무료를 썼는지" 정보 노출) 발견한
-- 김에 함께 잠근다. week_start_kst는 has_weekly_free 내부에서만 쓰이므로 완전히 잠가도 된다.
revoke execute on function public.has_weekly_free(uuid) from public;
revoke execute on function public.week_start_kst(timestamptz) from public;
