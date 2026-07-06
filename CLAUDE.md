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
차별점: 기상 후 3버튼 후기 → 모드별(바로 잠듦/뒤척임) 오프셋 즉시 학습.

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

전부 로컬: 서버·계정·API 호출 없음. AsyncStorage가 유일한 저장소.
이 원칙을 깨는 기능(AI 분석 등)은 BACKLOG v2 — 사용자 확인 없이 착수 금지.

학습 로직 (Phase 4-2, 도그푸딩 후 확정 — BACKLOG.md "구현됨" 참조):
알람 = 기준시각 + 소요시간. fast/slow는 latency(0~20분, 목표수면 20분 고정 + latency),
coffee는 caffeineOnset(15~35분, 커피 마신 시각 기준) — 3모드 독립 학습. 스텝은 모드별
미수렴 ±3분 → "딱 좋았어요" 1회 이후 ±2분. 스텝 크기·모델 구조 변경은 다시 도그푸딩
근거로 사용자가 확정한다. 임의 변경 금지.

기술 스택 (변경 시 반드시 사용자에게 확인)

- Expo SDK 57 + TypeScript strict + expo-router
- expo-audio (플레이어), expo-notifications (백업 알림), expo-keep-awake,
  expo-haptics, Reanimated + Gesture Handler (슬라이드 해제)
- android/ 디렉터리는 gitignore — 네이티브 설정의 단일 소스는 app.json
  (config plugin 옵션 포함. expo-audio는 recordAudioAndroid: false,
  enableBackgroundPlayback: false 명시 — 권한 자동 주입 방지)
- 빌드: npx expo run:android --device R3KL20GA0EE (Galaxy S24+ 실기기)
- Expo Go 사용 불가 (커스텀 네이티브 모듈)

도메인 모델 (src/store.ts — 단일 소스)

- NapMode: 'fast' | 'slow' | 'coffee' (커피는 별도 boolean이 아니라 3번째 모드)
- Settings: { latency: {fast,slow}(0~20분), caffeineOnset(15~35분), converged: {fast,slow,caffeine}, totalNaps }
- ActiveNap: { mode, startedAt, alarmAt(epoch ms), coffeeDrankAt?(mode==='coffee'만), notificationId }
- PendingFeedback: 알람 해제 시 ActiveNap을 여기로 옮기고 즉시 clear
  (후기 화면에서 강제 종료돼도 알람 재진입 없음). mode/offsetMinutes 보관.
- NapRecord: 후기 제출 시마다 append-only 기록 (완료 시각/mode/offsetMinutes/
  result/manualAdjustmentMinutes). UI 없음, 히스토리·분석 기능의 원료.

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

코드 규칙

- 커밋은 작은 단위로, 커밋 메시지는 영어 conventional 형식 유지 (fix:/docs:/chore:)
- 검증 3종 통과 후 커밋: tsc --noEmit, expo-doctor, expo export --platform ios
- 색상·radius·폰트는 theme.ts 토큰만. 하드코딩 금지 (DESIGN_HANDOFF)
- 단축 낮잠 테스트 버튼(10초/1분) 노출 여부는 src/config.ts의 SHOW_TEST_BUTTONS로 관리
  (도그푸딩 중엔 릴리즈 빌드에서도 노출되도록 true). __DEV__ 게이트 아님 — 정식 출시 전
  SHOW_TEST_BUTTONS=false 확인 (릴리즈 체크리스트)
- 시각 포맷은 src/format.ts 재사용

현재 단계
STATUS.md 참조. (이 파일에는 상태를 적지 않는다 — CLAUDE.md는 불변 규칙,
STATUS.md는 가변 상태)
