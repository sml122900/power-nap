# 서버 데이터 삭제 구현 범위 — 개별 테이블 DELETE 대신 auth.users 삭제 하나로 단일화

## Problem

개인정보처리방침에 넣을 "서버 데이터 삭제" 기능을 구현해야 했다. 요구사항은
`analyses`/`credit_events`/`credits`/`users` 네 테이블에서 요청한 유저의 행을 전부
지우는 것 — 그리고 별도로 "익명 계정(`auth.users`) 자체도 삭제할지"를 판단해야
했다. 순진하게 구현하면 서비스 role 클라이언트로 네 테이블에 각각 `DELETE ... WHERE
user_id = ?`를 순서대로 호출하거나, 그 로직을 담은 새 Postgres RPC 함수를 만들어야
할 것처럼 보였다 — 어느 쪽이든 새 마이그레이션이 필요해 보였다.

## Action

구현에 들어가기 전에 기존 스키마(`migrations/0001_ai_analysis_init.sql`)를 다시
읽었다. `public.users`가 `auth.users(id)`를 `on delete cascade`로 참조하고,
`credits`/`credit_events`/`analyses`가 다시 `public.users(id)`를 `on delete cascade`로
참조하는 체인이 **이미 존재**했다. 게다가 기존 통합 테스트
(`credit-ledger.test.ts`/`analyze.test.ts`)의 테스트 유저 정리 로직이 이미
`admin.auth.admin.deleteUser()` 한 번만 호출해 이 cascade에 의존하고 있었다 — 즉
새로 만드는 가정이 아니라 이미 검증되어 쓰이고 있던 메커니즘이었다.

"신원(auth.users)까지 지울지"는 별도 판단이 필요한 지점이었다. 이 앱은 이메일/비번
없는 순수 익명 계정이라 `auth.users` 행에는 재로그인에 쓸 자격증명이 전혀 없다 —
데이터만 지우고 신원을 남겨봐야 "빈 신원"으로만 남고 어떤 재사용 가치도 없다. 세션이
무효화돼 다음 사용 시 새 익명 계정이 자동 발급되는 것도, 이 앱이 이미 받아들인
트레이드오프(기기 분실 시 크레딧 소실, AI_ANALYSIS.md §8)와 같은 성격이라 부자연스럽지
않다고 판단했다. 그래서 신원도 함께 지우기로 결정했고, 그 결정이 곧 구현 방식도
정했다 — `auth.users` 행을 지우면 cascade가 나머지 세 테이블을 자동으로 정리하므로,
public 스키마를 직접 건드리는 코드가 아예 필요 없어졌다.

재시도 안전성도 별도로 설계할 필요가 없었다: `auth.users`가 삭제된 뒤 같은 JWT로
다시 호출하면 `admin.auth.getUser(jwt)`가 "user not found"로 자연스럽게 401을
내므로, 멱등성 처리를 위한 추가 코드가 필요 없었다.

## Result

새 마이그레이션이나 RPC 없이, 인증 후 `admin.auth.admin.deleteUser(userId)` 한 줄만
호출하는 ~30줄짜리 Edge Function으로 4테이블+신원 삭제를 완성했다. 삭제는 단일
Postgres 트랜잭션(cascade) 안에서 원자적으로 처리된다. 실제 배포된 함수에 대해
통합 테스트 4건(인증 없이 401, 삭제 후 4테이블 전부 빈 결과 확인, 타 유저 데이터
격리, 삭제된 유저 JWT로 재호출 시 자연스러운 401)을 실제 Supabase 프로젝트로
실행해 검증했다.

핵심 교훈: 새 기능을 설계하기 전에 "이미 있는 스키마 제약이 이 요구사항을 얼마나
대신 해줄 수 있는가"부터 확인하면, 요구사항을 글자 그대로("네 테이블을 지워라")
구현하는 대신 더 적은 코드로 같은 최종 상태를 만들 수 있다 — 특히 이번처럼 그
메커니즘이 이미 다른 곳(테스트 정리 로직)에서 검증되어 있었다면 신뢰도도 더 높다.
