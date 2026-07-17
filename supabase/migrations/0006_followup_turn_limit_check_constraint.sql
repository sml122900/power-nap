-- 0005가 놓친 두 번째 강제 지점 — append_followup_turn의 WHERE절만 3→10으로 바꾸면
-- 충분한 줄 알았으나, analyses.followup_turns_used 컬럼 자체에 0001에서 건
-- `check (followup_turns_used between 0 and 3)` 제약이 별도로 남아있어 4턴째부터
-- "check constraint violates" 23514 에러로 계속 막혔다(실기기 없이 통합 테스트로
-- 발견 — turn 4에서 매번 409, 원인 추적 결과 RPC의 WHERE절이 아니라 이 컬럼 제약이
-- 범인이었음). 같은 숫자를 두 곳(함수 WHERE절 + 컬럼 CHECK)에서 따로 강제하고
-- 있었다는 뜻 — 다음에 상한을 또 바꿀 때는 이 두 곳을 항상 함께 확인할 것.
alter table public.analyses drop constraint analyses_followup_turns_used_check;
alter table public.analyses add constraint analyses_followup_turns_used_check
  check (followup_turns_used between 0 and 10);
