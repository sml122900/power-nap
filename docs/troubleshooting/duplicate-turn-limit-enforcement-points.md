# 같은 상한값이 함수 WHERE절과 컬럼 CHECK 제약 두 곳에 독립적으로 박혀있던 문제

## 문제상황

AI 분석 후속 질문 턴 상한을 3 → 10으로 올리는 작업에서, Postgres 함수
`append_followup_turn`의 원자적 갱신 쿼리 `where ... and followup_turns_used < 3`이
"3턴 초과 방지"의 유일한 강제 지점이라고 판단했다(코드 주석에도 그렇게 적혀
있었다). 이 WHERE절만 `< 10`으로 바꾸는 마이그레이션을 작성해 배포했는데,
실서버 통합 테스트에서 4턴째 요청이 여전히 매번 409로 실패했다.

## 시도한 것들

1. 로컬 함수 소스를 다시 읽어 WHERE절이 정말 `< 10`으로 바뀌었는지 확인 —
   맞았다. 함수 자체는 의도대로 배포돼 있었다.
2. Edge Function 코드(`MAX_FOLLOWUP_TURNS` 상수)도 10으로 맞춰져 있는지 재확인
   — 이것도 맞았고, 실제로 리포트 생성 시 응답의 `turnsRemaining`은 10으로
   정상 표시됐다. 그런데도 후속 질문 4번째 호출은 계속 막혔다.
3. Edge Function을 거치지 않고 `append_followup_turn` RPC를 REST API로 직접
   호출해봤다 — 이번엔 HTTP 상태 코드와 에러 바디를 그대로 받을 수 있었고,
   `23514`(check constraint violation)와 함께
   `analyses_followup_turns_used_check` 제약 이름이 찍혀 나왔다. Edge
   Function의 뭉뚱그린 409 응답 뒤에 숨어 있던 진짜 원인이 드러난 순간이었다.
4. 마이그레이션 히스토리를 다시 grep해, 애초에 이 컬럼이 생성될 때
   (`analyses.followup_turns_used smallint ... check (between 0 and 3)`)
   WHERE절과는 별개로 상한이 한 번 더 박혀 있었다는 걸 확인했다.

## 최종 해결법

- 별도 마이그레이션(0006)으로 `analyses_followup_turns_used_check` 제약을
  drop한 뒤 `check (followup_turns_used between 0 and 10)`으로 재생성.
- 배포 후 같은 RPC를 REST API로 재호출해 4턴째가 정상 처리되는지 먼저
  확인한 다음, 전체 통합 테스트(10턴 정상 + 11턴째 409)로 최종 검증.
- CLAUDE.md 지뢰 목록에 "같은 상한값이 함수 로직과 테이블 제약 두 곳에
  독립적으로 있을 수 있다 — 함수만 보고 '여기가 유일한 강제 지점'이라고
  단정하지 말 것"을 기록.

## 이력서 소재 한 줄

애플리케이션 함수 로직만 고치고 성공을 확신하는 대신, 배포 후에도 실패가
반복되자 스택을 한 단계 더 내려가 원시 RPC 호출로 정확한 DB 에러 코드를
확인해 진짜 원인(테이블 레벨의 독립적인 CHECK 제약)을 찾아낸 사례.
