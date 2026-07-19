# 알림 스와이프는 "알람 관문"만 끝낸다 — 기상 루틴은 살려서 이어받는다

## Problem

`alarm-state-fix`(직전 세션)에서 알림 스와이프로 네이티브 알람만 죽고 `ActiveNap`은
JS에 그대로 남는 상태 불일치를 고쳤다 — `shouldTreatAsOrphaned`가 `/alarm` 재진입
직전에 네이티브 생존 여부를 확인해, 죽어있으면 `finalizeNapCleanup`으로 정리하고
기상 루틴(`/wake-stretch`)으로 보냈다. 실기기 검증까지 마쳤다.

그런데 이 감지는 `alarmDismissed`(= 슬라이드는 넘겼지만 명언은 아직 안 친 "미션
대기" 상태)일 때는 의도적으로 제외돼 있었다 — `shouldTreatAsOrphaned`에
`if (nap.alarmDismissed) return false;` 가드가 있었다. 그래서 사용자가 미션 화면까지
와서 알림을 스와이프하면: `ActiveNap`은 그대로 남고(`alarmDismissed:true`), 재진입 시
`resolveNapRoute`가 여전히 `/mission`을 내지만 워치독의 orphan 체크 게이트 자체가
`target === '/alarm'`일 때만 열려서 이 경우는 아예 검사하지 않았다. 결과: 사용자는
소리 없이 조용해진 미션 화면으로 되돌아가고, 화면이 재마운트되며 진동만 새로
시작되는 — 고쳤던 것과 같은 부류의 증상이 미션 단계에서 재발했다.

## Action

조사 결과 핵심 사실 두 가지를 확인했다:

1. **상태는 이미 분리돼 있었다.** `ActiveNap`(알람 단계, `useNapWatchdog`가 관리)과
   `PendingFeedback`(기상 루틴/설문 단계, 각 화면이 자체 마운트 가드로 관리)은 처음부터
   서로 다른 스토리지 키다. `finalizeNapCleanup`은 애초에 미션을 전혀 몰랐다 —
   `ActiveNap → PendingFeedback` 전환과 `/wake-stretch`(또는 `/feedback`) 라우팅만
   할 뿐, 기상 루틴/설문을 "완료 처리"하는 코드가 아니다. 그래서 실기기로 검증했던
   `/alarm`(슬라이드 전) 스와이프 케이스는 이미 기상 루틴을 정상적으로 살려서
   넘겨주고 있었다 — 새 상태나 새 필드 없이도 이미 되고 있던 일이었다.
2. **진짜 구멍은 감지 범위 하나였다.** `alarmDismissed:true`인데 `ActiveNap`이 여전히
   존재하는 경우는 논리적으로 "미션 대기 중"뿐이다 — 명언을 실제로 통과하면
   `finishNap`이 `ActiveNap` 자체를 지우므로 그 즉시 `nap === null`이 된다. 즉
   `alarmDismissed:true`이면서 nap이 살아있는 상태를 orphan 후보에서 빼는 것과, 그
   상태를 아예 별도 취급해야 하는 것은 다른 문제였는데, 기존 가드는 전자로
   뭉뚱그려 두 번째 케이스(스와이프)까지 같이 막고 있었다.

그래서 수정은 감지 범위를 넓히는 것 하나로 끝났다:

- `shouldTreatAsOrphaned`에서 `if (nap.alarmDismissed) return false;` 제거 — 이제
  "알람이 발화했고 네이티브가 죽었으면" 미션 대기 중이든 아니든 orphan이다.
- `useNapWatchdog.check()`의 게이트를 `target === '/alarm'`에서
  `target === '/alarm' || target === '/mission'`으로 확장 — `/mission`으로 갈
  예정일 때도 네이티브 생존 여부를 확인한다.
- `finalizeNapCleanup` 본체는 **한 글자도 안 바꿨다** — 애초에 미션을 모르니 그대로
  호출하면 자동으로 "명언 건너뛰고 기상 루틴부터"가 된다.

## Result

알림 스와이프는 정확히 "알람 해제 관문"(소리·진동·`/alarm`·`/mission`의 명언 관문)만
끝내고, 기상 루틴(`/wake-stretch`→`/wake-light`→`/wake-water`)과 설문(`/feedback`)은
그 이후 정상 흐름 그대로 사용자가 이어서 밟는다 — `finalizeNapCleanup`이 처음부터
그렇게 설계돼 있었기 때문에 별도 구현이 필요 없었다. `isPreview`(체험 낮잠)도 같은
경로를 그대로 타므로 `shouldRecordNap` 가드가 기록 스킵을 자동으로 처리한다(별도
분기 불필요 — `finalizeNapCleanup`이 `active.isPreview`를 이미 `PendingFeedback`으로
승계하고 있었으므로).

미션(명언)은 스와이프로 알람이 꺼지면 함께 건너뛰기로 결정했다 — "알람은 꺼졌는데
명언을 계속 요구"하는 게 어색하다는 판단. 트레이드오프: 미션은 원래 "노력을
강제해서 반쯤 잠든 채 대충 끄는 걸 막는" 장치인데, 알림 스와이프가 슬라이드+타이핑보다
쉬운 동작이라 이 경로가 미션의 우회로가 될 수 있다. 미션이 옵트인 기능이고, 미션
OFF 사용자는 이미 스와이프로 우회 가능한 것과 동일한 수준이라고 보고 감수하기로
했다(제품 판단, 사용자 확정).

핵심 교훈: "상태를 어떻게 나눌까"를 고민하기 전에 **지금 상태가 이미 나뉘어 있는지
코드로 확인하는 게 먼저다.** 이번엔 이미 분리돼 있었고, 문제는 그 분리된 상태 중
하나(미션 대기)로 가는 감지 경로가 좁게 막혀 있었을 뿐이었다 — 새 필드나 새 상태
머신을 만들 필요 없이 기존 가드 조건 하나를 넓히는 것으로 끝났다.
