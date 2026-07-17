# 미병합 브랜치에서 Edge Function을 배포해 다른 브랜치의 서버 수정이 되살아난 문제

## 문제상황

`mypage-polish` 브랜치에서 AI 분석 후속 질문이 JSON 스키마 그대로 새던 버그를
고치고(`buildFollowupSystemPrompt` 분리) 배포까지 마쳤다. 그런데 다음 작업인
"후속 질문 턴 상한 3→10 상향"을 위해 `main` 기준으로 새 브랜치
`followup-10turns`를 분기했다 — 이 시점엔 `mypage-polish`가 아직 `main`에
병합되지 않은 상태였다. `followup-10turns`에서 턴 상한만 고치고
`supabase functions deploy analyze`를 실행했더니, 이 브랜치의 `index.ts`엔
`mypage-polish`의 JSON 유출 수정이 없어 그 코드가 그대로 실서버에 올라갔다 —
고쳤던 버그가 조용히 되살아날 뻔한 상황.

## 시도한 것들

1. 배포 직후 실기기 재현 대신 라이브 API를 한 번 직접 호출해봤는데, 우연히
   자유 텍스트 응답이 나왔다. LLM 출력이 결정적이지 않다는 걸 감안하면 이
   결과만으로 "괜찮다"고 결론 내리는 건 착시일 수 있다고 판단해 더 신뢰할 수
   있는 근거를 찾기로 했다.
2. 현재 `followup-10turns` 브랜치의 `supabase/functions/analyze/index.ts`가
   `handleFollowup`에서 실제로 어느 프롬프트 함수(`buildSystemPrompt` vs
   `buildFollowupSystemPrompt`)를 참조하는지 소스 코드로 직접 확인 — 결과는
   `buildSystemPrompt`(구버전)였다. 동작 관찰이 아니라 소스 대조로 회귀를
   확정했다.

## 최종 해결법

- `main`에 `mypage-polish` → `followup-10turns` 순서로 병합해 두 브랜치의 수정
  (JSON 유출 수정 + 턴 상한 상향)이 모두 한 코드베이스에 존재하게 만들었다.
- `main`에서 검증 4종(tsc/expo-doctor/expo export/jest) + `expo-doctor` 20/20을
  확인한 뒤, `main` 기준으로 `analyze`를 재배포(version 10)해 이 상태를 최종
  서버 상태로 확정했다.
- 재배포 후 실서버 통합 테스트 7개(10턴 정상 + 11턴째 409 포함) 전부 통과 확인,
  서로 다른 질문 3개를 라이브로 호출해 답변이 전부 자유 텍스트임을(JSON 형태
  아님) 추가로 재확인했다.
- CLAUDE.md 지뢰 목록에 "Edge Function/마이그레이션은 브랜치와 무관하게 서버
  하나를 덮어쓴다 — 서버 배포는 main에서만" 규칙을 추가해, 기능 브랜치에서
  검증차 임시 배포했다면 병합 후 반드시 main에서 재배포하도록 못박았다.

## 이력서 소재 한 줄

라이브 API 응답 1회가 우연히 정상으로 보이는 상황에서 그 결과를 신뢰하지 않고
소스 코드 대조로 회귀를 확정한 뒤, "서버는 브랜치와 무관한 단일 배포 대상"이라는
근본 원인을 문서화된 규칙으로 남겨 같은 실수의 재발을 구조적으로 차단.
