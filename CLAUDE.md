# CLAUDE.md — 프로젝트 컨텍스트

> 이 파일은 Claude Code가 항상 읽는 프로젝트 개요다.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---
# Role & Tone: Caveman Mode (Extreme Conciseness)
- Speak like a caveman: Remove all fluff, pleasantries, introductory, and concluding remarks.
- Do not say "Sure, I can help with that" or "Here is the solution."
- Eliminate articles (a, an, the) and filler words where possible, but maintain precise technical/coding terms.
- Focus ONLY on the core answer, solution, or code snippet.



- Reduce output token usage by 70%+.
- Deliver immediate value without making me read a textbook.

---

프로젝트: PowerNap (원탭 낮잠 알람 앱)

한 줄 정의
졸려서 눈이 감기는 순간, 버튼 한 번으로 낮잠 알람을 맞추는 Android/iOS 앱.
사용자는 인지 자원이 바닥난 상태 — 계산·타이핑·메뉴 탐색을 전부 제거한다.
차별점: 기본값은 문헌 근거로 고정, 설정 화면/후기 화면에서 언제든 직접 조정.
기상 후 짧은 4문항 설문으로 수면 데이터 축적(향후 분석용, 즉시 반영 아님).

문서 체계 (세션 시작 시 이 순서로 읽을 것)
1. STATUS.md — 현재 어디까지 됐는지 (가변 상태. 매 작업 완료 시 갱신 필수)
2. PROJECT.md — 제품 스펙, 화면 명세, 데이터 모델, Phase 계획
3. DESIGN_HANDOFF.md — UI 원칙 (watchOS/토스/HIG 앵커, 색 제한, AI 티 금지)
4. BACKLOG.md — 보류된 기능. 여기 있는 건 요청 없이 구현 금지

핵심 원칙 (모든 작업에서 지킬 것)

알람 신뢰성이 제품의 생명: 알람이 안 울리면 앱의 존재 이유가 없다.
- 알람 판정은 항상 ActiveNap.alarmAt(epoch ms) vs Date.now() 절대시각 비교.
  setInterval 감산 방식 절대 금지 (백그라운드에서 JS 타이머는 멈춘다).
- 플랫폼별 주 레이어가 다르다(상세는 PROJECT.md §4):
  - **Android**: 네이티브 알람(`expo-alarm-module`, `AudioManager.STREAM_ALARM`)이 주 레이어.
    무음모드·미디어볼륨과 무관하게 백그라운드/종료/잠금 상태에서도 자체 재생한다.
    `alarm.tsx`의 expo-audio는 Android에서 꺼져 있음(화면/햅틱/해제만 JS 담당).
  - **iOS**: 기존 3중 레이어 유지 — 포그라운드 오디오(무음 스위치 우회) + 로컬 알림 백업 + 진동.
  - 예약/취소(Android는 schedule/removeAlarm, iOS는 로컬 알림)는 반드시 쌍으로
    (취소 누락 = 유령 알람).
- 화면 리다이렉트 책임은 useNapWatchdog 단일 소유. 화면별 자체 리다이렉트 추가 금지
  (Phase 2에서 이중 replace 레이스 버그로 확정된 규칙).

원탭 원칙: 잠들기 전 인터랙션은 현재의 원탭에서 절대 늘리지 않는다.
컨텍스트 수집(장소·자세 등)은 후기 시점에만.

전부 로컬: v1.1부터 AI 분석에 한해 서버 사용(AI_ANALYSIS.md 참조), 그 외 기능은
여전히 로컬 전용.

다국어(i18n, v1.2부터): 서버(`supabase/functions/analyze`)는 언어와 완전히 무관하게
유지한다. `analyze` Edge Function의 JSON 에러 응답에서 `error` 필드(안정적 snake_case
코드)만 클라이언트가 신뢰하는 계약이고, `message` 필드는 서버 로그/디버그 전용 영어
텍스트일 뿐 — 클라이언트가 사용자에게 그대로 노출하지 않는다. 실제 표시 문구는
`src/aiAnalysisErrors.ts`가 `error` 코드를 `locales/ko.json`/`locales/en.json`으로
매핑해 만든다(새 에러 코드 추가 시 이 매핑을 안 채우면 TS 컴파일 에러). AI 리포트
본문 언어만 예외 — `analysis-v2.ts`의 `buildSystemPrompt(locale)`이 앱이 보낸 `locale`
파라미터로 출력 언어를 결정한다(에러 메시지 경로와는 별개). 새 언어 추가 시 앱
쪽(`locales/*.json` + `format.ts` 포맷터)만 확장하면 되고 Edge Function은 안 건드린다.

학습 로직 (Phase 4-3, 도그푸딩 후 확정 — BACKLOG.md "구현됨"/"학습 구조 전환 근거" 참조):
알람 = 기준시각 + 소요시간. fast/slow는 latency(0~20분, 목표수면 20분 고정 + latency),
coffee는 caffeineOnset(15~35분, 커피 마신 시각 기준). **자동 조정 없음** — 이 값을
바꾸는 경로는 설정 화면과 후기 화면 "직접 조정하기"(수동 조정)뿐. 후기 화면의 4문항
설문(자세/소음/빛/만족도)은 순수 데이터 수집이며 latency/caffeineOnset에 영향 없음.
근거: 만성 수면부족 사용자의 "부족함" 피드백은 수면부채 신호일 수 있어 자동 조정은
과잉 반응 위험. clamp 범위·수동 조정 구조 변경은 다시 도그푸딩 근거로 사용자가
확정한다. 임의 변경 금지.

기술 스택 (변경 시 반드시 사용자에게 확인)

- Expo SDK 57 + TypeScript strict + expo-router
- expo-audio (플레이어), expo-notifications (백업 알림), expo-keep-awake,
  expo-haptics, Reanimated + Gesture Handler (슬라이드 해제)
- android/ 디렉터리는 gitignore — 네이티브 설정의 단일 소스는 app.json
  (config plugin 옵션 포함. expo-audio는 recordAudioAndroid: false,
  enableBackgroundPlayback: false 명시 — 권한 자동 주입 방지)
- 빌드: npx expo run:android --device R3KL20GA0EE (Galaxy S24+ 실기기)
- Expo Go 사용 불가 (커스텀 네이티브 모듈)
- Metro/dev 서버는 포트 8080만 사용 (기본 8081은 다른 프로젝트와 충돌) —
  `npx expo start --port 8080`, `npx expo run:android --port 8080` 등 항상 --port 8080 명시

도메인 모델 (src/store.ts — 단일 소스)

- NapMode: 'fast' | 'slow' | 'coffee' (커피는 별도 boolean이 아니라 3번째 모드)
- Settings: { latency: {fast,slow}(0~20분), caffeineOnset(15~35분), totalNaps } (converged 없음 — Phase 4-3 폐지)
- ActiveNap: { mode, startedAt, alarmAt(epoch ms), coffeeDrankAt?(mode==='coffee'만), notificationId }
- PendingFeedback: 알람 해제 시 ActiveNap을 여기로 옮기고 즉시 clear
  (후기 화면에서 강제 종료돼도 알람 재진입 없음). mode/offsetMinutes 보관.
- NapRecord: 후기 제출 시마다 append-only 기록. v1(레거시, result/manualAdjustmentMinutes)과
  v2(Phase 4-3, survey/memo/manualAdjust)가 공존 — 히스토리는 둘 다 렌더. UI는 히스토리
  열람뿐, 분석 기능은 아직 없음(BACKLOG v2).

지뢰 목록 (밟았던 버그 — 재발 금지)

- useAudioPlayer의 플레이어는 언마운트 시 자동 release. 클린업에서 pause/stop
  호출 금지 (해제된 객체 접근 크래시, 2d8d5db). 정지는 내비게이션 전 단 한 곳.
- 이펙트 클린업은 등록 순서대로 실행된다 — useAudioPlayer(위) 클린업이
  우리 이펙트(아래) 클린업보다 먼저 돈다.
- 모듈 레벨 플래그(alarmPlaybackActive 등)는 리셋 경로를 반드시 확인.
  연속 2회차 낮잠에서 소리 안 나는 유형의 버그 원천.
- prebuild는 app.json plugin 기본값으로 권한을 주입한다. 매니페스트 검증은
  aapt dump permissions로 최종 APK에서.
- tsconfig.json/app.json의 자동 변경은 커밋 전 출처 확인 (prebuild vs 실수).
- Android 알림 채널은 생성 후 importance/sound/vibration을 코드로 재설정할 수 없다
  (OS가 최초 생성 시점 설정을 고정). 채널 설정을 바꿀 때마다 채널 ID를 버전업해
  새 채널로 만들어야 한다 (예: 'alarm' → 'alarm-v2') — 안 그러면 기존 설치 기기에서
  구설정이 그대로 박제돼 코드를 고쳐도 반영되지 않는다(백업 알림 무음 버그 원인).
- 알람(STREAM_ALARM)이 울리는 중에 물리 볼륨키를 누르면 안드로이드가 그 입력을
  미디어 스트림이 아니라 지금 재생 중인 알람 스트림 쪽으로 돌린다(OS 기본 동작).
  "소리 안 남" 리포트를 받으면 코드부터 의심하지 말고 `dumpsys audio`로 알람
  스트림 볼륨이 눌려서 깎여있는지부터 확인할 것.
- Postgres는 새 함수의 EXECUTE를 anon/authenticated에 기본 개방한다. REVOKE FROM public으로는
  안 막힘 — 마이그레이션에서 함수 생성 시 anon/authenticated 명시 revoke + service_role
  grant를 매번 확인 (Phase B에서 실공격 검증으로 확인된 사항).
- expo-router 신규 라우트는 expo export만으로 타입 재생성이 안 됨 — 라우트 추가 후
  tsc 전에 expo start 1회 필요.
- 알림 권한(POST_NOTIFICATIONS)과 네이티브 알람 예약은 별개 — 권한 체크가 알람 예약
  경로를 막지 않게. Android 13+는 알림 권한 기본 거부라 이 경로가 흔함.
- 테스트 파일(.test.ts/.test.tsx)을 app/ 디렉터리에 두면 expo-router require.context가
  앱 시작 시점에 그 파일을 즉시 require한다. 컴포넌트 테스트는 src/에 둘 것.
  **`expo export`가 항상 이걸 잡아주는 건 아니다** — 실제 재현으로 두 가지 서로 다른
  깨짐 방식을 확인함:
  (a) `expo-router/testing-library`처럼 Node 전용 의존성(`path` 등)을 끌어오면
      Metro가 모듈을 못 찾아 export 자체가 **빌드 시점에 에러로 실패**한다
      (settings.test.tsx/mypage.test.tsx가 여기 해당했던 이유).
  (b) `jest.mock(...)`처럼 테스트 전역 함수만 최상단에서 호출하는 파일은 문법적으로
      멀쩡해서 Metro가 **아무 에러 없이 번들링을 통과**시킨다 — `expo export`는 번들이
      "만들어지는지"만 검증하지 "실행되는지"는 실행해보지 않기 때문. 실제 앱(디버그
      Metro 연결/릴리즈 임베드 불문)에서 그 모듈이 로드되는 순간 "Property 'jest'
      doesn't exist"로 크래시한다(app/history.test.ts가 이 케이스, expo export
      ios/android 둘 다 통과한 채로 몇 차례나 커밋된 뒤에야 실기기 디버그 런타임에서
      발견됨). 즉 이 지뢰는 **export 통과 여부로 안심하면 안 되고**, app/ 디렉터리
      직접 `find app -iname "*.test.*"`로 매번 눈으로 확인하는 게 유일하게 믿을 수
      있는 검증이다.
- EXPO_PUBLIC_* 환경변수는 babel-preset-expo의 인라인 플러그인이 `process.env.FOO`
  같은 **정적** 멤버 접근만 빌드 시점에 리터럴로 치환한다. `process.env[변수명]`처럼
  동적 접근을 쓰면 아무것도 치환되지 않고 런타임엔 항상 undefined다(.env 값 자체는
  멀쩡한데 "값이 없다" 에러가 반복되는 원인 — src/purchases.ts의 resolveApiKey가
  실제로 이렇게 걸렸었다, 커밋 fa0c4a9). 값 존재 여부를 의심하기 전에 코드가
  `process.env.EXACT_NAME` 형태로 읽는지부터 확인할 것. 검증은 반드시 실제 빌드
  산출물(APK 내 JS 번들)에서 grep으로 값 자체를 찾을 것 — 변수 "이름" 문자열은
  에러 메시지 등에 섞여 있어도 나오므로 `grep "이름\|값"`처럼 OR로 뭉뚱그려 확인하면
  이름만 매치되고도 통과한 것처럼 착각한다(실제로 이 착각으로 하루를 날린 사례).
- RevenueCat Test Store API 키는 디버그 빌드에서만 동작한다 — 릴리즈(서명) 빌드에서
  초기화하면 SDK가 "Wrong API Key ... app will close to protect security of test
  purchases"로 앱을 강제 종료시킨다(공식 문서에 명시된 의도된 보안 장치, iOS/Android
  공통, 공식 우회 방법 없음). Test Store로 결제 파이프라인을 검증할 땐 반드시
  `npx expo run:android`(디버그 variant)로 설치할 것 — `gradlew assembleRelease`로는
  검증 불가. Play Console 계정(DUNS) 발급 후 실스토어 전환 시에만 릴리즈 빌드로
  넘어간다(src/config.ts REVENUECAT_STORE='play').
- RevenueCat `Purchases.getProducts(ids, type)`의 두 번째 인자(PRODUCT_CATEGORY)를
  생략하면 기본값이 SUBSCRIPTION이라, 우리 상품 같은 소모성(NON_SUBSCRIPTION) 상품은
  조용히 빈 배열만 돌아온다(에러도 안 남 — "상품을 못 찾았다"는 결과만 보고 코드가
  잘못됐다고 오판하기 쉬움). 소모성 상품은 항상
  `PRODUCT_CATEGORY.NON_SUBSCRIPTION`을 명시할 것(src/purchases.ts 참고).
- 알람 예약은 실패할 수 있다 — 호출부에 try/catch 없으면 낮잠이 조용히 시작 안 되고
  사용자는 앱이 멈춘 것으로 인식한다. `expo-alarm-module`의 `Helper.scheduleAlarm`은
  `SCHEDULE_EXACT_ALARM` 권한이 꺼져 있으면(Android 12/12L에서 사용자가 끌 수 있음,
  minSdkVersion 24라 이 OS 버전도 지원 대상) `canScheduleExactAlarms()` 체크 없이
  바로 `SecurityException`을 던진다. `app/index.tsx`의 낮잠 시작 경로가 이걸
  try/catch로 잡아 안내 다이얼로그(+ Android는 설정 딥링크)를 보여주게 고쳤다 —
  네이티브 예약 호출을 추가하거나 바꿀 땐 항상 실패 경로를 사용자에게 드러낼 것
  (POST_NOTIFICATIONS 때와 같은 유형의 함정).
- Postgres에서 같은 상한값이 두 곳에 독립적으로 박혀있을 수 있다 — 하나만 고치면
  다른 하나가 계속 막는다. `analyses.followup_turns_used`가 실제 사례: 컬럼 자체의
  `check (between 0 and 3)`(migrations/0001)와 `append_followup_turn` 함수 WHERE절의
  `< 3`(migrations/0002)가 같은 숫자를 따로 강제하고 있었다. 함수만 10으로 바꾸고
  배포했더니 4턴째부터 계속 409(`23514 check constraint violates`)가 났다 — 원인이
  RPC WHERE절인 줄 알고 거기만 고친 게 문제였다(migrations/0005). 컬럼 제약을
  놓쳤다는 걸 알기까지 직접 REST API로 RPC를 호출해 에러 코드를 봐야 했다
  (migrations/0006). 테이블 컬럼에 상한을 바꿀 땐 `\d+ 테이블명`이나 마이그레이션
  파일 전체를 grep해서 CHECK 제약까지 같이 찾을 것 — 함수 로직만 보고 "여기가
  유일한 강제 지점"이라고 단정하지 말 것.
- Edge Function(`supabase/functions/*`) 변경은 APK 재빌드로 반영되지 않는다 — 앱
  번들에는 서버 코드가 포함되지 않고, 실행은 항상 Supabase에 이미 배포된 버전을
  탄다. `supabase functions deploy <함수명>`을 별도로 실행해야만 반영된다(코드 수정
  커밋만으로는 실서버가 안 바뀜 — `supabase functions list`의 `updated_at`으로 배포
  여부 확인 가능). 후속 질문이 JSON 스키마 그대로 새던 버그를 코드로 고친 뒤에도
  실기기에서 재현된 사례(`analyze` 함수가 커밋 이후 8일간 미배포 상태였음)로 확정된
  규칙. 서버·앱 변경이 섞인 작업을 마칠 때는 서버 쪽 배포 여부를 보고에 반드시
  명시할 것 — "코드 수정 완료"와 "실제로 반영됨"은 다른 말이다.
- Edge Function/마이그레이션은 브랜치와 무관하게 서버 하나를 덮어쓴다. 미병합
  브랜치에서 deploy하면 다른 브랜치의 서버 수정이 조용히 원복될 수 있다 —
  실제로 mypage-polish에서 고친 후속질문 JSON 유출 수정이, `main` 기준으로 분기한
  followup-10turns에서 `supabase functions deploy`를 실행하는 순간 사라질 뻔했다
  (2026-07-17, 병합 전 소스 검토로 확정). **서버 배포는 main에서만 한다.** 기능
  브랜치에서 검증차 임시 배포했다면, 병합 후 반드시 main에서 다시 배포해 최종
  상태를 맞출 것.
- `useNapWatchdog`의 orphan 정리(`shouldTreatAsOrphaned`/`finalizeNapCleanup`,
  알림 스와이프로 네이티브 알람만 죽고 `ActiveNap`은 JS에 남는 경로 감지)는
  **"알람 단계"(소리·진동·`/alarm`·`/mission` 명언 관문)까지만 정리 범위다 — 기상
  루틴(`/wake-stretch`~`/wake-water`)·설문(`/feedback`)은 절대 여기서 손대지 않는다.**
  `finalizeNapCleanup`은 `ActiveNap`을 `PendingFeedback`으로 옮기고 그 다음 화면으로
  라우팅만 할 뿐, 기상 루틴/설문을 "완료 처리"하는 게 아니다 — 그 이후 진행은 항상
  사용자가 직접 밟는다. 새 정리 로직을 추가할 때 이 범위를 넘어서 `PendingFeedback`이나
  `wakeChecklist`까지 건드리면 안 됨(`docs/decisions/swipe-ends-alarm-only.md`).
- `AlarmService.onStartCommand()`(expo-alarm-module)의 `Helper.getAlarmNotification()`이
  하는 Bitmap 디코딩은 `startForeground()` 호출을 지연시킨다 — 화면 잠금/Doze로
  브로드캐스트·서비스 디스패치까지 늦춰지는 상황과 겹치면 OS의 foreground-service
  시작 제한시간을 넘겨 `ForegroundServiceDidNotStartInTimeException`으로 앱
  프로세스 전체가 죽는다(실기기 재현, 2026-07-19). `plugins/withAlarmForegroundStartFix.js`가
  `startForeground()`만 최소 알림으로 앞당겨 이 크래시는 막았지만, 같은 Bitmap
  디코딩 지연 뒤에야 호출되는 `Manager.start()`(→ `activeAlarmUid` 세팅, JS의
  `isNativeAlarmActiveAsync()`가 폴링하는 값)의 순서는 그대로다 — "네이티브 알람은
  fire했는데 `activeAlarmUid`는 아직 안 세팅된" 좁은 창은 이 패치로 줄지 않았다
  (BACKLOG.md "미해결 — 알람 fire 직후 자체취소 레이스" 참고). 이 영역을 다시 만질
  땐 크래시와 레이스를 같은 원인으로 섣불리 합치지 말 것 — 코드 경로가 다르다.

코드 규칙

- 커밋은 작은 단위로, 커밋 메시지는 영어 conventional 형식 유지 (fix:/docs:/chore:)
- 검증 3종 통과 후 커밋: tsc --noEmit, expo-doctor, expo export --platform ios
- 색상·radius·폰트는 theme.ts 토큰만. 하드코딩 금지 (DESIGN_HANDOFF)
- 단축 낮잠 테스트 버튼(10초/1분) 노출 여부는 src/config.ts의 SHOW_TEST_BUTTONS로 관리
  (도그푸딩 중엔 릴리즈 빌드에서도 노출되도록 true). __DEV__ 게이트 아님 — 정식 출시 전
  SHOW_TEST_BUTTONS=false 확인 (릴리즈 체크리스트)
- RevenueCat 결제 검증 스토어(TEST/PLAY)는 src/config.ts의 REVENUECAT_STORE로 관리
  (SHOW_TEST_BUTTONS와 동일한 명시적 상수 패턴, __DEV__ 게이트 아님). Play Console
  실스토어 출시 직전 REVENUECAT_STORE='play' 확인 (릴리즈 체크리스트, AI_ANALYSIS.md
  §7 Phase D 참고)
- 시각 포맷은 src/format.ts 재사용
- 컴포넌트 렌더 테스트는 @testing-library/react-native 사용 (app/settings.test.tsx가 첫 사례)

현재 단계
STATUS.md 참조. (이 파일에는 상태를 적지 않는다 — CLAUDE.md는 불변 규칙,
STATUS.md는 가변 상태)
