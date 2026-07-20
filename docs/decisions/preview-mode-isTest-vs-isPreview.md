# 체험 모드(isPreview)를 QA 테스트 낮잠(isTest)과 별개 플래그로 분리

## Problem

`SHOW_TEST_BUTTONS`(개발용, 정식 출시 전 false로 끌 예정)로만 노출되는 홈 화면의
10초/1분 단축 낮잠 버튼을, 출시 빌드에도 상시 노출되는 사용자 대상 "체험" 기능으로
따로 제품화하기로 했다. 요구사항은 두 가지가 동시에 걸려 있었다:

1. 체험 낮잠은 QA 테스트 낮잠(`isTest`)과 달리 **기록·AI 분석·통계 어디에도 흔적을
   남기면 안 된다** — `isTest`는 지금도 `NapRecord`에 남고(히스토리에 "테스트" 뱃지로
   표시) AI 분석 대상에서만 빠진다(`docs/decisions/test-nap-full-parity-guarded.md`).
   체험은 이보다 한 단계 더 나가서 기록 자체가 생기면 안 된다.
2. 체험 버튼은 `SHOW_TEST_BUTTONS`와 **완전히 독립**이어야 한다 — 그 플래그가
   `false`(정식 출시 빌드)여도 항상 보여야 한다.

`isTest` 하나로 두 요구사항을 다 처리하려고 하면, "정식 출시 빌드에서도 보이는
버튼이 만드는 낮잠"과 "개발자만 보는 QA 버튼이 만드는 낮잠"이 같은 필드에 뒤섞여
`SHOW_TEST_BUTTONS`를 나중에 `false`로 끌 때 체험 버튼까지 같이 사라지거나, 반대로
QA 테스트 낮잠까지 기록이 안 남는 식으로 개념이 충돌할 위험이 있었다.

## Action

`ActiveNap`/`PendingFeedback`에 `isTest`와 완전히 독립된 `isPreview` 필드를
새로 추가하고, 기존 `isTest` 코드는 전혀 건드리지 않았다:

1. **진입점 분리**: 홈 화면(`app/index.tsx`)의 `startFastSlow(mode, overrideMs?,
   isPreview?)`에 세 번째 인자를 추가했다. QA 테스트 버튼(1분/10초)은 여전히
   `overrideMs`만 넘긴다(`isTest: overrideMs !== undefined && !isPreview`로 계산 —
   기존 두 버튼의 동작은 100% 그대로). 신규 "10초 알람 체험" 버튼은
   `startFastSlow('fast', 10_000, true)`로 `isPreview: true`만 켠다. 이 버튼은
   `{SHOW_TEST_BUTTONS && (...)}` 블록 **바깥**에 둬서 그 플래그와 무관하게 항상
   렌더된다.
2. **라우팅은 그대로 안 건드림**: `resolveNapRoute`(`useNapWatchdog.ts`)와
   `resolveFinishNapDestination`(`finishNap.ts`)은 `isTest`도 원래 안 봤고
   `isPreview`도 마찬가지로 안 본다 — 두 플래그 모두 "실제 알람과 완전히 동일한
   흐름을 태운다"가 요구사항이라, 라우팅 단계에서 분기하지 않는 게 오히려 정답이다.
   `finishNap`은 `active.isPreview`를 `PendingFeedback`에 실어 나르기만 한다.
3. **부작용 지점 하나에서만 분기**: `app/feedback.tsx`에 새 순수 함수
   `shouldRecordNap(ctx)`(`src/store.ts`)를 만들어 제출/건너뛰기/직접조정 3개
   경로 전부에서 `appendNapRecord` 호출 여부를 이 함수로 결정한다 —
   `isPreview`일 때만 `false`, `isTest`는 이 함수에서 아예 안 본다(QA 테스트 낮잠은
   여전히 기록에 남아야 하므로). "직접 조정하기"의 `applyManualAdjustment` 호출은
   `isTest`든 `isPreview`든 둘 다 건너뛴다(`!ctx.isTest && !ctx.isPreview`) — 둘 다
   학습값(`latency`/`caffeineOnset`/`totalNaps`)을 오염시키면 안 되는 건 공통이라서.
4. **`NapRecord`에는 `isPreview` 필드 자체를 안 만듦**: `appendNapRecord`가 체험
   낮잠에서는 아예 호출되지 않으므로, `NapRecord`가 존재하는 시점엔 이미 항상
   `isPreview: false`와 동치다. `filterAnalyzableRecords`도 그래서 안 건드렸다 —
   볼 게 없다.
5. **완료 안내**: 별도 모달 없이 기존 토스트 메커니즘에 얹었다 — 제출/건너뛰기/직접조정
   3경로 전부, `ctx.isPreview`면 `toastManualAdjustTestSkipped`/`toastRecorded` 대신
   `toastPreviewNotSaved`("체험이라 기록에는 남기지 않았어요.")를 보여주고 홈으로
   돌려보낸다. 흐름을 끊는 확인 다이얼로그를 넣지 않았다(사용자 지시 — "자연스럽게").

## Result

`isTest`(QA, 기록에 남되 분석 제외)와 `isPreview`(사용자, 기록 자체가 안 생김)가
서로 다른 필드·서로 다른 진입점·서로 다른 게이트(`SHOW_TEST_BUTTONS` vs 상시)로
완전히 독립적으로 존재한다. `SHOW_TEST_BUTTONS`를 정식 출시 전 `false`로 꺼도 체험
버튼은 영향받지 않고, 반대로 체험 버튼을 나중에 제거하거나 정책을 바꿔도 QA 테스트
낮잠 경로(`test-nap-full-parity-guarded.md`에서 확정한 동작)는 전혀 안 건드린다.

라우팅(`resolveNapRoute`/`resolveFinishNapDestination`)은 두 플래그를 몰라도 되는
게 핵심 설계 — "실제와 동일한 경험"이라는 두 기능의 공통 요구사항이 자연히
라우팅을 플래그 무관하게 만들었고, 데이터 부작용(기록 저장·학습값 반영)만 각
플래그가 독립적으로 막는다. `test-nap-full-parity-guarded.md`가 정립한 "방어를
화면 단위가 아니라 실제 부작용이 발생하는 지점 하나로 좁혀서 옮긴다"는 패턴을
그대로 재사용한 것 — 새 플래그를 추가할 때도 같은 자리(`shouldRecordNap`
가드 + `applyManualAdjustment` 가드)에 조건만 하나 더 얹으면 됐다.
