# 기상 루틴/설문 단계의 콜드 스타트 복구

## Problem

직전 커밋(`swipe-ends-alarm-only.md`)에서 알림 스와이프 후 재진입 시 명언을 건너뛰고
기상 루틴부터 재개하도록 고쳤다. 그런데 그 복구는 **같은 앱 프로세스가 살아있는
상태(백그라운드→포그라운드)에서만 작동한다** — `finalizeNapCleanup`이 `ActiveNap`을
`PendingFeedback`으로 바꾸고 `/wake-stretch`(또는 `/feedback`)로 `router.replace`하는
건 어디까지나 **현재 마운트된 화면이 직접 navigate하는 것**이기 때문이다.

프로세스 자체가 죽으면(강제종료, 삼성 절전 최적화가 백그라운드 앱을 정리하는 경우
등) 얘기가 달라진다. `useNapWatchdog`은 `/`·`/sleep`·`/alarm`·`/mission` 네 화면에서만
쓰이고, `/wake-stretch`~`/feedback`은 마운트 시 `PendingFeedback`이 없으면 홈으로
보내는 가드만 있을 뿐 "있으면 그리로 데려가는" 로직이 없다. `app/_layout.tsx`도
초기 라우트를 결정하는 코드가 없어 **콜드 스타트는 항상 `/`(홈)에서 시작**한다.
홈의 워치독은 `ActiveNap`만 본다 — 그래서 기상 루틴/설문 도중 죽었다가 재실행하면
`PendingFeedback`은 영원히 고아로 남고 사용자는 그냥 홈 화면에 떨어진다. 방금 고친
"스와이프 종료 후 기상 루틴 이어받기"가 실사용(폰을 내려놓으면 백그라운드에서
죽는 흔한 경우)에서 그대로 깨지는 셈이었다.

## Action

조사 결과 상태 자체는 이미 충분했다 — `PendingFeedback.wakeChecklist`가 기지개/빛/물
중 뭘 마쳤는지 이미 다 담고 있어서, 새 필드나 새 상태 머신 없이 "다음 화면이 뭔지"
계산하는 순수 함수 하나면 됐다.

1. `resolveWakeRoute(pending, wakeRoutineEnabled)`(`src/finishNap.ts`) 신규 —
   `wakeChecklist`에서 처음으로 안 끝난 단계를 찾아 그 화면으로, 다 끝났으면
   `/feedback`으로. `wakeRoutineEnabled`를 인자로 받는 이유: `PendingFeedback`엔
   "이번 낮잠이 기상 루틴을 거쳤는지" 자체가 저장 안 된다(`resolveFinishNapDestination`이
   그 순간의 설정값으로 한 번 판정하고 흘려버림) — 복구 시점에도 현재 설정을 다시
   읽어 같은 방식으로 판정한다(`finalizeNapCleanup`과 동일 패턴).
2. `useNapWatchdog`의 `check()`에 `getPendingFeedback()`을 `Promise.all`에 추가하고,
   `if (!nap && pending)` 분기를 `resolveNapRoute` 판정보다 먼저 넣어 `resolveWakeRoute`로
   리다이렉트한다.

## Result

**이 분기는 사실상 홈 화면에서만 의미 있게 발동한다** — `/sleep`·`/alarm`·`/mission`은
마운트돼 있는 동안 `nap`이 항상 존재하고(둘 다 없어지는 유일한 경로인
`finalizeNapCleanup`/`finishNap`은 그 즉시 같은 함수 안에서 `router.replace`까지
호출해 화면을 옮겨버린다), `/wake-stretch`~`/feedback`은 애초에 `useNapWatchdog`을
안 써서 정상 진행 중엔 이 코드가 실행될 일이 없다. 그래서:

- **정상 흐름 비간섭**: 기상 루틴 화면들이 서로 넘어가는 동안 이 훅 자체가 관여하지
  않는다 — 물리적으로 실행될 수 없는 화면들이라 "끼어들어 오작동"할 방법이 없다.
- **orphan 정리 체인과 충돌 없음**: 프로세스가 살아있으면 `/mission`→(orphan 감지)→
  `/wake-stretch`가 한 컴포넌트의 한 `check()` 호출 안에서 끝난다. 프로세스가 죽었으면
  홈→(`resolveNapRoute`가 `/mission`으로)→`/mission` 마운트→(그 화면 자신의 워치독이
  orphan 감지)→`/wake-stretch`, 2홉으로 끝난다. 크래시가 `finalizeNapCleanup` *이후*
  (기상 루틴 도중)라면 홈에서 `pending`만 있고 `nap`은 없으니 1홉 직행. 각 홉은 서로
  다른 컴포넌트 인스턴스(각자 새 `redirectedRef`)라 겹칠 여지가 없다.
- **`isPreview`/`isTest`는 그대로 안전**: `resolveWakeRoute`는 둘 다 안 본다(라우팅은
  두 플래그를 모른다는 기존 원칙 유지). `PendingFeedback.isPreview`는 이미 있는 필드라
  이 복구 경로를 타든 정상 경로를 타든 `/feedback`에서 `shouldRecordNap` 가드가
  동일하게 작동한다.

핵심 교훈: 이번에도 "새 상태가 필요한가?"가 먼저 떠오르지만, 답은 두 번 연속
"아니다"였다 — `PendingFeedback`/`wakeChecklist`가 이미 복구에 필요한 모든 정보를
갖고 있었고, 빠진 건 그 정보를 읽어서 라우팅하는 지점(콜드 스타트가 떨어지는 홈
화면의 워치독) 하나뿐이었다.
