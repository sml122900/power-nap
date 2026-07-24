# 파워냅 (PowerNap) — 원탭 낮잠 알람 앱

> Claude Code 실행용 스펙 문서. 이 문서와 `powernap-prototype.html`(디자인 레퍼런스)을 레포 루트에 두고 Phase 순서대로 진행한다.

---

## 1. 제품 한 줄 정의

**졸려서 눈이 감기는 순간, 버튼 한 번으로 낮잠 알람을 맞추는 앱.**
사용자는 인지 자원이 바닥난 상태다. 계산·타이핑·음성 명령·메뉴 탐색을 전부 제거한다.

### 핵심 차별점 — 원탭 시작 + 직접 조정 가능한 개인화
- 대기시간·카페인 발현시간 기본값은 수면 문헌 근거로 고정, 설정 화면(또는 후기 화면
  "직접 조정하기")에서 언제든 실측 기반으로 직접 조정 (§5)
- 기상 후 짧은 컨디션 체크(자세·소음·빛 차단·만족도 4문항)로 수면 데이터를 쌓아
  향후 분석(BACKLOG v2)에 활용 — 이 응답이 시간을 자동으로 바꾸지는 않는다
- "매우 졸림 / 조금 졸림 / 커피냅" 3모드 독립 관리 (§5)

---

## 2. 디자인 헌법 (모든 UI 결정의 기준)

1. **watchOS Glanceable 원칙** — 2초 안에 읽고, 탭 1번으로 끝난다. 화면당 액션 최대 2개. "이 요소가 애플워치 화면에 들어가는가?"로 기능 크립을 거른다.
2. **토스 One Thing per One Page** — 화면당 사용자 결정은 1개.
3. **Apple HIG 구현 디테일** — Dynamic Type 존중, 모든 탭에 햅틱 피드백, 다크모드 자동 대응, 터치 타겟 최소 44pt(핵심 버튼은 120pt+).
4. **금지**: 아이콘 장식, 그라데이션, 일러스트, 화면당 3색 초과. 위계는 폰트 굵기(800/700/600)와 크기로만.

### 디자인 토큰 (prototype.html과 동일)
```
brand:      #4353E0   (딥 페리윙클 — CTA, 알람 화면 배경)
brandPress: #3542C4
brandTint:  #EEF0FD
night:      #12172A   (수면 화면 배경)
nightSoft:  #8B93B0
amber:      #E8981F   (커피 컨텍스트 전용)
amberTint:  #FDF3E2
ink:        #161D2E / inkSoft #5A6478 / inkFaint #98A0B3
line:       #DFE4EE
surface:    #FFFFFF / bg #ECEFF5
radius:     lg 24 / md 16
숫자는 전부 tabular-nums
```

---

## 3. 기술 스택

- **Expo SDK 최신 안정 버전** + TypeScript + expo-router
- 상태/영속화: **AsyncStorage** (서버 없음, 전부 로컬)
- 오디오: **expo-audio** — 알람 사운드 재생. iOS 무음 스위치 무시 옵션(`playsInSilentMode` 계열) 필수. *구현 전 최신 API 문서 확인할 것.*
- **expo-notifications** — 백업 알람용 로컬 알림
- **expo-haptics** — 모든 버튼 탭
- **expo-keep-awake** — 수면 화면에서 화면 꺼짐 방지(단, 밝기는 최저로 유도)
- EAS Build, custom dev client 필요 시에만 prebuild

---

## 4. 알람 신뢰성 전략 (이 앱의 존재 이유 — 최우선)

**전제**: 낮잠은 폰을 옆에 두고 앱을 켠 채 잔다. 밤잠 알람과 다르다.

플랫폼별로 주 레이어가 다르다 (도그푸딩 중 Android 백업 알림이 무음+진동 1회만 나는
문제가 발견돼, Android는 Phase 5 예정이던 네이티브 알람을 앞당겨 도입했다):

**Android — 네이티브 알람이 주 레이어**
- `expo-alarm-module`(`AlarmManager.setExactAndAllowWhileIdle` + `AudioManager.STREAM_ALARM`)이
  예약/재생을 전담. 앱이 백그라운드/종료/잠금 상태여도 무음모드·미디어볼륨 슬라이더와
  무관하게 자체 스트림으로 연속 재생한다(`src/notifications.ts`).
- `alarm.tsx`의 expo-audio 재생은 Android에서 꺼져 있다 — 화면/햅틱/해제만 담당.
  슬라이드/롱프레스 해제 시 `stopNativeAlarmSoundAsync()`(→ 라이브러리의 `stopAlarm()`)로
  네이티브 사운드를 멈춘다.
- 알림 자체의 dismiss/snooze 액션 버튼은 켜지 않는다(`showDismiss/showSnooze: false`) —
  버튼으로 조용히 끄면 우리 해제 화면을 건너뛰기 때문. 알림 "본문"을 탭해야 앱이 열리고,
  그 뒤 `useNapWatchdog`이 `/alarm`으로 보낸다(별도 라우팅 로직 추가 없음).
- **풀스크린 인텐트로 화면 자동 점등 구현 완료** (`plugins/withFullScreenAlarmIntent.js`,
  실기기 검증 완료) — 화면이 꺼져 있거나 잠금 상태일 때 알람 시각에 자동으로 화면이
  켜지며 해제 화면으로 직행한다.
  - **알려진 특성(OS 정책, 버그 아님)**: 화면이 켜진 채 잠금 해제된 상태에서 알람이
    울리면, Android가 풀스크린 인텐트 대신 일반 헤드업(머리말) 알림으로 강등시킨다 —
    이건 Android 자체 정책(포그라운드에서 전체화면 액티비티를 함부로 띄우지 못하게 막는
    것)이라 앱에서 우회할 수 없다. 알람음/진동은 이 경우에도 정상적으로 계속 재생된다
    (기존 STREAM_ALARM 레이어가 담당) — 실사용 낮잠 시나리오(화면 꺼짐/잠금 상태로
    자는 것)에서는 정상적으로 자동 점등된다.
  - 알림을 스와이프로 지우면(`setDeleteIntent`) 우리 화면을 거치지 않고 네이티브 소리만
    꺼진다 — 라이브러리 동작이라 그 자체는 못 막는다. 다만 이 경로가 `ActiveNap`을 안
    건드려서(JS 코드가 전혀 안 탐) 재진입 시 `useNapWatchdog`이 죽은 알람 화면으로
    되돌아가 진동만 남는 상태 불일치가 있었다 — `isNativeAlarmActiveAsync()`(내부적으로
    `expo-alarm-module`의 `getAlarmState()` 재사용, 네이티브 패치 불필요)로 워치독이
    `/alarm` **또는 `/mission`** 진입 직전에 네이티브가 실제로 아직 울리는지 확인해
    죽어있으면 `finalizeNapCleanup`으로 정리 후 feedback/wake-stretch로 보내도록 수정
    (`alarm-state-fix` 브랜치, `src/useNapWatchdog.ts`/`src/finishNap.ts`). **스와이프는
    "알람 해제" 관문만 끝낸다** — 슬라이드로 알람은 넘겼지만 명언은 아직인 상태(미션
    대기 중)에서 스와이프해도 같은 경로로 감지되어 명언은 건너뛰고 기상 루틴부터
    재개한다(명언·기상 루틴은 서로 다른 스토리지 키(`ActiveNap`/`PendingFeedback`)로
    이미 분리돼 있어 새 상태 없이 orphan 감지 범위만 넓히는 것으로 충분했다).
    `finalizeNapCleanup` 자체는 기상 루틴/설문을 "완료 처리"하지 않는다 — `/wake-stretch`
    (또는 `/feedback`)로 정상 라우팅만 하고, 그 뒤 진행은 여느 정상 해제와 동일하게
    사용자가 직접 밟는다. 상세 근거는 `docs/decisions/swipe-ends-alarm-only.md`.
  - **기상 루틴/설문 도중 프로세스가 죽어도(강제종료, 절전 최적화 등) 재실행 시 그
    지점부터 복구된다** — `useNapWatchdog`이 `ActiveNap`뿐 아니라 `PendingFeedback`도
    보고, 없으면(=콜드 스타트가 항상 떨어지는 홈 화면에서) `resolveWakeRoute`로
    `wakeChecklist` 진행 상태를 읽어 알맞은 기상 루틴 화면(또는 `/feedback`)으로
    보낸다(`docs/decisions/wake-routine-cold-start-resume.md`). 새 상태 없이
    `PendingFeedback`에 이미 있던 정보로 해결됨.
  - 커스텀 사운드(`assets/sounds/alarm.wav`) 미지원 — 라이브러리가 재생음을 `"default"`로
    하드코딩해서(`Manager.java`) 시스템 기본음이 나간다. 커스터마이즈하려면 네이티브 포크 필요.
  - **알림 권한(POST_NOTIFICATIONS) 거부 시나리오 실기기 검증 완료**:

    | 알림 권한 | 화면 상태 | 소리·진동 | 화면 자동점등 + 해제 화면 |
    |---|---|---|---|
    | 거부 | 무관 | 정상 발화 | 안 됨(배너도 없음) — 사용자가 직접 앱을 열어야 진입 가능 |
    | 허용 | 꺼짐/잠금 | 정상 발화 | 자동 점등 + 해제 화면 직행 |
    | 허용 | 켜짐 + 잠금해제 | 정상 발화 | 풀스크린 대신 헤드업 배너만(위 "알려진 특성"과 같은 OS 정책) |

    소리·진동은 권한과 완전히 무관(STREAM_ALARM 레이어). 권한 거부 시 화면 자동 점등만
    안 되므로, `app/sleep.tsx`가 Android + 권한 거부 조합에서 "소리·진동은 울리니 알람이
    울리면 직접 앱을 열어 꺼달라" 안내 + 설정 딥링크 버튼을 보여준다. 권한 없이 앱을
    직접 열면 `useNapWatchdog`이 마운트 시점에 `alarmAt` 경과를 판정해 `/alarm`으로
    보낸다(권한과 무관하게 항상 동작 — 코드 확인 완료).
- 진동: 네이티브 레이어 자체 진동(연속) + JS `Haptics` 인터벌(양쪽 플랫폼 공통, `alarm.tsx`)이
  중복으로 울릴 수 있음 — 실사용에서 거슬리면 Android 쪽 JS 햅틱 인터벌을 끄는 것을 검토.
- **SCHEDULE_EXACT_ALARM / USE_FULL_SCREEN_INTENT 거부 시나리오 코드 확인 + 최종 APK
  매니페스트(`aapt dump`) 검증 완료**:

  | 권한 | 코드상 동작 | 실기기 결과 |
  |---|---|---|
  | `SCHEDULE_EXACT_ALARM` | `expo-alarm-module`의 `Helper.scheduleAlarm`이 `canScheduleExactAlarms()` 체크 없이 바로 `AlarmManager.setExactAndAllowWhileIdle`을 호출한다 — 권한이 꺼져 있으면 `SecurityException`이 던져진다. 이 예외는 이제 `app/index.tsx`의 낮잠 시작 경로(try/catch)가 잡아 "알람을 설정하지 못했어요" 안내 + Android는 설정 딥링크(`REQUEST_SCHEDULE_EXACT_ALARM`)까지 보여준다(수정 전에는 조용히 삼켜져 버튼을 눌러도 화면이 그대로였음). | 재현 여부와 무관하게 구조적 결함(실패가 조용히 삼켜짐)으로 판단해 수정 — 최종 APK가 `minSdkVersion 24`(Android 12/12L 포함)를 지원해 이 권한이 실사용자에게 실재하는 경로임을 확인 |
  | `USE_FULL_SCREEN_INTENT` | `plugins/withFullScreenAlarmIntent.js`가 주입한 패치가 `canUseFullScreenIntent()`를 체크하지만 결과와 무관하게 로그만 남기고 진행한다 — 거부돼도 크래시 없이 시스템이 일반 헤드업 알림으로 자동 대체(코드상 안전 확인됨) | 실기기 확인 대상은 "화면이 실제로 켜지는지" 뿐, 크래시 위험은 코드로 배제됨 |

  최종 릴리즈 APK(`aapt dump badging/permissions`)로 직접 확인: `minSdkVersion=24`,
  `targetSdkVersion=36`. `SCHEDULE_EXACT_ALARM`에 `maxSdkVersion="32"`를 붙이고
  `USE_EXACT_ALARM`을 33+ 전용으로 분리하는 표준 패턴이 **아니고**, 두 권한 모두
  SDK 조건 없이 무조건 선언돼 있다 — 런타임 동작에는 문제 없음(OS가 자기 API
  레벨에 안 맞는 권한은 알아서 무시), 다만 `USE_EXACT_ALARM`은 Play가 "알람이
  핵심 기능인 앱"으로 제한하는 민감 권한이라 Play Console 등록 시 소명이 필요함
  (릴리즈 체크리스트 항목, STATUS.md 참고).

  **실기기 실증(Galaxy S24+, Android 14/API 34) 완료**: 시스템 설정 어디에도
  "알람 및 리마인더"(정확한 알람 예약) 토글이 노출되지 않는다 — Android 13+에서
  `USE_EXACT_ALARM`을 선언한 앱은 이 권한이 자동 부여되고 사용자가 끌 수 있는
  UI 자체가 없다는 공식 동작이 이 기기에서 그대로 확인됨(`SecurityException`
  경로가 실제로 트리거될 수 없는 OS 버전). **Android 12/12L(API 31~32)의
  "알람 및 리마인더" 토글 끄기 시나리오는 이 기기로 재현 불가** — 그 OS
  구간에서만 노출되는 사용자 조작이라 실기기 없이는 확인할 수 없다. 재현
  여부와 무관하게 `app/index.tsx`의 try/catch + 안내 다이얼로그(위 표 참고)가
  구조적으로 이 경로를 방어하므로, 미보유 OS 버전에 대한 잔여 리스크는
  낮다고 판단.

**iOS — 기존 3중 레이어 그대로 유지** (네이티브 알람 대응 라이브러리가 무음스위치 우회를
못 주므로 변경 없음):
1. **주 알람 (포그라운드)**: 수면 화면이 떠 있는 동안 JS 타이머 + expo-audio로 최대 볼륨 알람 재생. iOS 무음 모드에서도 재생되도록 오디오 세션 설정. keep-awake로 화면 유지, 수면 화면은 다크(#12172A)로 배터리/눈부심 최소화.
2. **백업 알람 (로컬 알림)**: 낮잠 시작 시 동일 시각에 로컬 알림도 예약(`expo-notifications`). 앱이 백그라운드로 가거나 종료돼도 알림은 울린다. 알람 해제/취소 시 예약 취소.
3. **진동**: 알람 발화 시 Haptics 반복 패턴 병행.
- `playsInSilentMode`는 무음 스위치만 우회할 뿐, 미디어 볼륨 슬라이더 자체는 우회하지 못한다.
  근본 해결(볼륨 무시 알람 스트림)은 iOS 26 AlarmKit 영역 — Phase 5 별도 과제로 유지.

공통 주의사항:
- 낮잠 시작 시 알림 권한 요청(최초 1회). 거부 시 "앱을 켠 채로 두면 알람이 울려요" 안내.
- 앱이 백그라운드에서 복귀했을 때 `alarmAt`이 지났으면 즉시 알람 화면으로 진입 (elapsed-time 체크, JS 타이머 신뢰 금지 — `Date.now()` 기준 절대시각 비교). Android 네이티브 알람 경로도 결국 `useNapWatchdog`의 같은 판정을 탄다.
- **Phase 5 (MVP 이후, iOS만 남음)**: iOS 26 AlarmKit 네이티브 모듈 조사 후 도입.
  Android 풀스크린 인텐트/화면 자동점등은 구현·실기기 검증 완료(위 참고).
- **최근앱 목록에서 앱을 스와이프해도 알람 소리는 안 꺼진다 — 의도된 동작**(버그 아님).
  Android 네이티브 알람(`AlarmService`, foreground service)이 앱 프로세스와 별개로
  돌기 때문 — 일반 알람 앱과 동일한 동작이며, 스와이프로 알람이 꺼지면 이 앱의 존재
  이유(알람 신뢰성)와 모순된다. 고칠 계획 없음.

---

## 5. 데이터 모델 & 학습 로직 (Phase 4-3 — 자동 조정 폐지, 수동 조정 + 설문 데이터 수집)

알람 = 기준시각 + 소요시간. 모드별로 기준시각과 소요시간의 의미가 다르다:
- 일반 낮잠(fast/slow): 알람 = 낮잠 시작 + `TARGET_SLEEP_MIN`(상수 20분) + `latency[mode]`(수동 조정)
- 커피냅(coffee): 알람 = 커피 마신 시각(`coffeeDrankAt`) + `caffeineOnset`(수동 조정)

```ts
type NapMode = 'fast' | 'slow' | 'coffee';  // 매우 졸림 / 조금 졸림 / 커피냅
const TARGET_SLEEP_MIN = 20; // 목표 수면시간(분) — 조정 대상 아님, 고정 상수

interface Settings {
  latency: Record<'fast' | 'slow', number>;         // 분, clamp 0~20. 초기값 { fast: 0, slow: 10 }
  caffeineOnset: number;                             // 분, clamp 15~35. 초기값 25
  totalNaps: number;
  missionEnabled: boolean;      // 알람 해제 미션(명언 타이핑) on/off, 기본 false
  wakeRoutineEnabled: boolean;  // 기상 직후 3화면(기지개/빛/물) on/off, 기본 true
}

interface ActiveNap {
  mode: NapMode;
  startedAt: number;       // epoch ms — 낮잠(또는 커피냅 확정) 시작 시각
  alarmAt: number;         // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffeeDrankAt?: number;  // epoch ms — mode==='coffee'일 때만
  notificationId: string | null;
  notificationPermissionGranted: boolean; // 알림 권한 승인 여부(알람 성패와는 무관)
  isTest?: boolean;     // 홈 화면 단축 테스트 버튼(10초/1분) — 기록/학습 미반영
  isPreview?: boolean;  // "10초 알람 체험" 버튼 — appendNapRecord 자체를 스킵
  alarmDismissed?: boolean; // 슬라이드/롱프레스 통과 여부(미션 켜져 있을 때 재판정용)
}

type SurveyRating = 'high' | 'mid' | 'low'; // 상 / 중 / 하

interface NapSurvey {
  posture: SurveyRating;      // 자세 편안함
  noise: SurveyRating;        // 소음 차단
  light: SurveyRating;        // 빛 차단
  satisfaction: SurveyRating; // 수면 만족도
}

interface NapRecord {  // 후기 제출 시마다 append-only, UI 없음(히스토리/분석 원료)
                        // 체험 낮잠(isPreview)은 애초에 여기 안 남는다 — §6.1 참고
  completedAt: number;
  mode: NapMode;
  offsetMinutes: number;                 // 이번 낮잠에 실제 사용된 총 시간(분)
  isTest?: boolean;                      // 테스트 낮잠(ActiveNap.isTest 승계) — 표시만, 학습 미반영

  // v1(레거시, Phase 4-2 이전 3버튼 후기) — 신규 레코드는 설정 안 함, 히스토리 하위호환용
  result?: 'tooDeep' | 'justRight' | 'notEnough' | 'manual' | 'manual-settings' | 'test';
  manualAdjustmentMinutes?: number;

  // v2(Phase 4-3)
  survey?: NapSurvey | null;             // "건너뛰기" 제출 시 null
  memo?: string;                          // 선택 메모
  manualAdjust?: {                        // 수동 조정 — latency/caffeineOnset을 바꾸는 유일한 경로
    source: 'feedback' | 'settings' | 'ai-analysis';  // ai-analysis: AI 리포트 제안을 그대로 적용
    beforeMinutes: number;
    afterMinutes: number;
  };
  wakeChecklist?: { stretch: boolean; light: boolean; water: boolean }; // 기상 루틴 체크 여부
}
```

**학습 구조 전환 (Phase 4-3 확정 — 도그푸딩 근거):**
- 자동 ±스텝 조정을 전부 폐지했다. 이전 모델(`applyFeedback`, `converged`, 적응형 스텝
  ±3→±2)은 삭제.
- 근거: 만성 수면부족 사용자의 "아직 부족해요" 피드백은 낮잠 길이가 짧아서가 아니라
  누적된 수면부채(sleep debt)의 신호일 가능성이 높다 — 매 후기마다 자동으로 시간을
  늘리면 실제로 도움이 안 되는 방향(과도하게 긴 낮잠)으로 과잉 반응하게 된다.
- 그래서 `latency`/`caffeineOnset` 기본값은 문헌 근거로 고정하고(BACKLOG.md 근거 섹션),
  개인화는 두 경로로만 이루어진다:
  1. **수동 조정** — 설정 화면 또는 후기 화면 "직접 조정하기"에서 숫자를 직접 입력/스테퍼로
     바꾼다(`applyManualAdjustment`). clamp(latency 0~20, caffeineOnset 15~35)는 그대로 가드로 유지.
  2. **축적 데이터 분석** — 후기 설문(4문항)+메모가 쌓이면 이후 BACKLOG v2의 AI 분석
     기능이 이 데이터를 소비해 조정을 "제안"한다(자동 반영 아님, 출시 후 별도 기능).
- 후기 화면의 4문항 설문(자세 편안함/소음 차단/빛 차단/수면 만족도, 각 상·중·하)은
  **latency/caffeineOnset에 어떤 영향도 주지 않는다** — 순수 데이터 수집이다. "건너뛰기"로
  설문 없이도 NapRecord는 저장된다(survey: null).
- 커피냅 알람 계산 결과가 지금부터 60초 미만이면(이미 카페인이 돌고 있는 시점) now+10분으로
  보정한다(`computeCoffeeAlarmAt`) — 커피 시각 프리셋/직접입력 모두 이 함수를 거친다.
- 마이그레이션: 구형 `{fast, slow}` 또는 `{fast,slow,fastCoffee,slowCoffee}` 오프셋 저장값은
  getSettings 로드 시 1회 `latency[mode] = clamp(offsets[mode] − TARGET_SLEEP_MIN)`으로 변환되고
  v3 형태로 다시 저장된다. `caffeineOnset`은 구형 커피 버킷 값을 승계하지 않고 항상 기본값(25분)
  에서 재시작한다(사용자 확정 사항). 구형 `converged` 필드는 있어도 그냥 무시하고 버린다.
- 히스토리 화면은 구형(v1, `result` 필드 보유) NapRecord와 신형(v2, `survey`/`manualAdjust`
  보유) NapRecord를 둘 다 렌더링한다 — 과거 기록을 지우거나 바꾸지 않는다.

앱 재시작 시 `ActiveNap`이 저장돼 있고 `alarmAt`이 미래면 수면 화면 복원, 과거면 알람 화면으로 진입.

---

## 6. 화면 명세 (핵심 4개 화면 — prototype.html 참조 + 설정 토글로 켜는 미션 화면 1개 + 정보 화면 1개)

### 6.0 온보딩 (첫 실행 튜토리얼)

첫 실행 시 1회 자동 노출되는 전체화면 슬라이드 4장. "졸리면 그냥 누르세요"가 앱
철학이라 첫 실행을 여러 장으로 가로막는 것 자체가 모순이라, 건너뛰기를 항상
노출한다(필수 UX 요구사항).

- 가로 스와이프(`ScrollView` pagingEnabled, 별도 캐러셀 라이브러리 없음) + 하단 점
  인디케이터 4개. 우측 상단 "건너뛰기"는 1~3장에서만 노출, 4장은 "시작하기" 버튼으로
  대체(둘 다 같은 동작 — 완료 플래그 저장 후 홈으로).
- **4장 구성**(1장 1주제): ① 3모드(매우 졸림/조금 졸림/커피냅) 차이 ② 미션·기상루틴은 설정에서
  켤 수 있음 ③ AI 분석은 주 1회 무료 ④ 위젯 — 홈 화면에 추가해두면 버튼 한 번으로 앱이
  열리고 알람까지 바로 맞춰진다(위젯 탭 시 "앱이 안 열린다"는 오해를 주지 않도록 문구
  주의, `docs/decisions/home-screen-widgets-static-deeplink.md` 참고).
- **노출 판정**: `shouldShowOnboarding`(순수 함수, `src/onboarding.ts`) — 온보딩
  미완료 + 위젯 딥링크 진입이 아님 + 진행 중이던 낮잠/설문(`ActiveNap`/`PendingFeedback`)
  이 없을 때만 true. 위젯 액션과 낮잠 복귀는 사용자의 명시적 의도/이미 시작된 흐름이라
  온보딩보다 우선한다 — 둘 중 하나라도 걸리면 온보딩은 다음 기회로 미뤄진다(완료 플래그를
  건드리지 않음).
- 완료 여부는 `AsyncStorage`(`getOnboardingComplete`/`setOnboardingComplete`,
  `src/store.ts`)에 저장, 건너뛰기도 완료로 기록(다시 안 뜸). 설정 화면 "둘러보기"
  섹션의 "온보딩 다시 보기"로 언제든 재생 가능.
- `app/index.tsx`가 마운트 시 1회(`onboardingCheckedRef`) 판정해 `router.replace('/onboarding')`
  — `useNapWatchdog`과는 독립적인 관심사라 서로 경쟁하지 않는다(nap/pending이 없으면
  `resolveNapRoute`도 `'/'`를 돌려줘 watchdog은 애초에 replace를 안 부르고, nap/pending이
  있으면 `shouldShowOnboarding`이 false라 온보딩 effect가 아무것도 안 함 — 두 훅이 동시에
  replace를 부르는 경우가 구조적으로 없음).
- 다크/라이트 테마 따름(`useThemeColors`, 새 색 없이 기존 토큰만) — 수면/알람/미션/
  기상루틴 화면과 달리 테마 고정 화면이 아니다.

### 6.1 홈
- 상단: "지금" + 현재 시각(실시간)
- 헤드: "졸리면 / 그냥 누르세요"
- **버튼 3개**:
  - Primary(brand 채움, 128pt+): "매우 졸림" + "{TARGET_SLEEP_MIN+latency.fast}분 뒤 · 오후 h:mm 알람"
  - Secondary(외곽선, 128pt+): "조금 졸림" + 동일 포맷
  - 커피냅(amber 계열, 64pt — fast/slow보다 낮은 위계): "커피냅" + "커피 마시고 {caffeineOnset}분 뒤 기상"
- **커피냅 탭 → 인라인 확장**: 기존 3버튼 아래에 프리셋 칩 4개(방금/5분전/10분전/직접입력)가
  펼쳐짐(≤150ms, reduce-motion 시 즉시 표시). 다시 탭하면 접힘(토글). 프리셋 칩은 탭 즉시
  낮잠 시작(원탭 유지) — 알람은 `커피 시각 + caffeineOnset`. 직접입력만 예외: "몇 분 전" 숫자
  입력 + ±스테퍼(0~120분, 기본 0) → 실시간 미리보기("오후 h:mm 알람 (n분 뒤)", 계산 결과가
  이미 과거/60초 이내면 "카페인이 이미 돌고 있어요" 안내와 함께 now+10분으로 보정) → 확정
  버튼으로 시작. 칩 패널이 펼쳐진 채로 1·2번 버튼을 탭하면 칩은 무시하고 그 모드로 즉시 시작.
- 하단: 학습 상태 캡션 1줄
- **체험 모드**: 하단에 텍스트 링크 "10초 알람 체험"(`SHOW_TEST_BUTTONS`와 무관하게
  출시 빌드에도 상시 노출) — 탭하면 `ActiveNap.isPreview: true`로 10초 낮잠을 시작해
  실제 알람과 완전히 동일한 흐름(수면→알람→미션(켜져있으면)→기상루틴→후기)을 겪지만
  기록·AI 분석·학습값(latency/caffeineOnset/totalNaps) 어디에도 남지 않는다 — 후기
  화면 완료 시 "체험이라 기록에는 남기지 않았어요" 토스트로 홈 복귀. `SHOW_TEST_BUTTONS`
  게이트인 QA 테스트 낮잠(`isTest`, 기록엔 남되 AI 분석에서만 제외)과는 완전히 별개
  플래그·경로(`docs/decisions/preview-mode-isTest-vs-isPreview.md` 참고).

### 6.1.5 홈 화면 위젯 (Android, S/M/L 3종)

앱을 열지 않고 홈 화면에서 바로 낮잠 알람을 거는 진입점. 헤드리스 JS 없이(조사 결과
채택 안 함 — `docs/decisions/home-screen-widgets-static-deeplink.md`) 딥링크로 앱을 열어
기존 홈 화면 로직(startFastSlow/커피냅 인라인 패널)을 그대로 태운다 — 위젯 전용 새
알람 경로 없음.

- **위젯 S**(3×2 셀, ~180×110dp): 버튼 1개(매우 졸림)
- **위젯 M**(4×2 셀, ~250×110dp): 버튼 2개(매우 졸림/조금 졸림), 동일 높이·위계
- **위젯 L**(4×3 셀, ~250×180dp): 버튼 3개 — 매우 졸림/조금 졸림(상단, 동일 높이) + 커피냅(하단
  전폭, 낮은 띠 — 홈 화면 coffeeBtn과 동일한 위계 낮춤)
- 세 종류 모두 삼성 날씨 위젯처럼 위젯 추가 목록에 별도로 뜨고, 사용자가 원하는 크기를
  골라 배치한다(하나의 위젯이 리사이즈로 변신하는 방식 아님).
- **탭 동작**: 매우 졸림/조금 졸림 → `powernap:///?widgetMode=fast|slow` 딥링크로 앱이 열리고
  `app/index.tsx`의 `handleWidgetModeEntry`가 기존 `startFastSlow(mode)`를 그대로
  호출 → 수면 화면 직행. 커피냅 → `?widgetMode=coffee`로 열려 새 화면이 아니라 기존
  인라인 커피냅 패널(칩 4개+직접입력)을 펼친다(RemoteViews는 정적 뷰라 위젯 안에서
  시각 입력 불가 — 앱의 기존 입력 경험을 그대로 재사용).
- **재탭 가드**: `ActiveNap`이 이미 있으면(다른 낮잠 진행 중) 모드 무관하게 안내
  토스트만 띄우고 기존 알람을 그대로 둔다(`resolveWidgetModeAction`, `src/store.ts`) —
  `useNapWatchdog`의 비동기 리다이렉트와 타이밍을 경쟁하지 않도록 독립적으로
  `getActiveNap()`을 먼저 확인한다.
- **위젯 얼굴 텍스트**: 네이티브 `strings.xml`(디바이스 언어 따름, 앱 내 언어 설정과는
  독립 — 불일치는 감수하기로 확정)로 관리, 잔여시간/실시간 갱신 없음(정적 안내 문구만).
- 구현: `plugins/withHomeScreenWidgets.js`(config plugin, 서드파티 라이브러리 없이
  바닐라 `AppWidgetProvider` 3종 + 레이아웃/드로어블/문자열 리소스 신규 생성).

### 6.2 수면
- 배경 night, 호흡 도트(4s, reduced-motion 존중), 카운트다운(76pt, mm:ss)
- 기상 안내: 일반 낮잠 "오후 h:mm에 깨워드릴게요" / 커피냅 "카페인 발현에 맞춰 오후 h:mm에
  깨워드릴게요" — 커피 여부는 홈 화면에서 이미 확정되므로 이 화면엔 토글 없음
- 안내 문구("휴대폰을 놓고 눈을 감으세요")를 은은하게 페이드 인/유지/페이드 아웃(7s
  사이클, opacity 0.2~1.0 — 완전히 0까지 안 내려 깜빡임처럼 안 보이게) 반복, reduced-motion
  존중(호흡 도트와 같은 effect에서 같이 스킵)
- 하단: "그만 자고 일어나기" 고스트 버튼
- keep-awake 활성, 진입 시 알림 백업 예약

### 6.3 알람
- 배경 brand, 링 펄스 애니메이션, "일어날 시간이에요" + "5분 더 자면 수면 관성 때문에 더 멍해져요"
- 커피냅이었으면: "지금부터 카페인 효과가 시작돼요" 배지
- **해제는 탭이 아니라 슬라이드 제스처** (M3 스타일 "밀어서 끄기") — 비몽사몽 오터치 방지.
  슬라이드 손잡이를 3초간 가만히 눌러도 해제(길게 누르기 폴백, 밀기와 같은 손잡이에 결합)
- 미션이 꺼져 있으면: 슬라이드 완료 전까지 사운드+진동 반복, 완료 시 정지+낮잠 종료
  (기존 동작). 미션이 켜져 있으면: 이 슬라이드는 알람을 끄는 게 아니라 6.3.5(명언
  화면)로 넘어가는 게이트일 뿐 — 사운드+진동은 6.3.5까지 계속 울린다(사용자 지시,
  안내 문구도 "밀어서 끄기" 대신 "밀어서 다음으로"로 갈린다). 실제 정지·낮잠 종료는
  6.3.5에서 처리(`src/finishNap.ts`).

### 6.3.5 미션 — 알람 해제 미션 (설정 토글, 기본 OFF)

설정에서 켜면 6.3(슬라이드/롱프레스 해제) **다음에** 이 화면을 거친다(사용자 지시로
확정된 순서 — 도입 당시엔 반대 순서였음) — 뒷단(6.4)은 그대로. `useNapWatchdog.
resolveNapRoute`가 `Settings.missionEnabled`와 `ActiveNap.alarmDismissed`를 함께
봐서 목적지를 정한다(BACKLOG.md "알람 해제 미션" 참고). 명언 통과 시 실제 사운드
정지·알림 취소·기록 저장(`src/finishNap.ts`)까지 한 번에 처리하고 낮잠을 종료한다 —
이 순서에서 명언은 항상 마지막 단계라 별도의 "통과 여부" 추적이 필요 없다.
**단, 명언을 직접 통과하지 않고 알림을 스와이프로 지운 경우**(§4 "알림을 스와이프로
지우면" 참고)엔 예외적으로 명언 자체를 건너뛰고 기상 루틴부터 재개한다 — 명언은
"알람 해제 관문"인데 스와이프로 이미 알람이 꺼진 상태에서 명언을 계속 요구하는 게
오히려 어색하다는 판단(`docs/decisions/swipe-ends-alarm-only.md`).

- 배경 brand(6.3과 동일 톤), 명언(`src/missionQuotes.ts`의 `MissionQuote` — `{ text,
  author }`, 기본값 `MISSION_QUOTES` 한/영 각 20개(고전 인용, 실존 인물 출처 명시)
  또는 사용자가 커스텀한 목록)의 `text`를 보여주고 그대로 따라 입력하게 한다. 아래에
  `— {{author}}` 캡션(author 있을 때만). **명언을 행 단위로 추가·수정·삭제 가능**
  (사용자 지시) — 별도 화면 `app/mission-quotes.tsx`(설정 화면 "명언 수정" 링크에서
  진입, 미션 토글 ON일 때만 노출 — 설정 화면이 길어진다는 피드백으로 인라인에서 분리,
  BACKLOG.md "알람 해제 미션" 참고)
- 대조는 명언의 `text`만 보고 공백·구두점 제거 + 소문자화 후 비교(오타 하나로 막히지
  않게, author는 판정 대상 아님). 건너뛰기 없음
- 3회 연속 실패하면 명언 대신 고정 탈출 문구(`ESCAPE_PHRASE`, ko "기상 완료"/en "I am
  awake")를 요구한다("'{{phrase}}'를 입력하면 넘어갈 수 있어요" 안내와 함께). 이 문구도
  틀리면 계속 재시도 — 더 이상의 폴백은 없다(2026-07-18, 도그푸딩 근거로 "더 짧은
  명언으로 교체" 방식을 폐지 — 명언이 계속 안 맞으면 확실한 탈출구가 필요하다는 판단).
  판정 로직은 `src/missionQuotes.ts`의 `resolveMissionAttempt`(순수 함수)로 분리
- 사운드+진동은 6.3 슬라이드 이후에도 이 화면까지 계속 재생(`src/useAlarmPlayback.ts` 공유)
- 하드웨어 뒤로가기 차단(6.3과 동일)
- 테스트 낮잠(`isTest`)도 미션을 탄다(사용자 지시로 변경 — 테스트 버튼으로 미션 화면
  자체를 확인하려는 목적, 후기 화면의 isTest 스킵과는 별개). BACKLOG.md "알람 해제 미션" 참고

### 6.4 후기 (Phase 4-3 — 4문항 설문 + 메모로 개편)
- "낮잠 어땠어요?" + 학습 상태 한 줄("내 수면 대기시간: 매우 졸림 n분 · 조금 졸림 n분" 또는
  커피냅 후기면 "내 카페인 발현: n분")
- **4문항 설문**: 자세 편안함 / 소음 차단 / 빛 차단 / 수면 만족도, 각각 상·중·하
  세그먼트 컨트롤(기본값 "중" — 다르게 느낀 문항만 탭, 최대 4탭으로 전부 커스터마이즈
  가능). 응답은 latency/caffeineOnset에 영향 없음(순수 데이터 수집, §5).
- **메모**: 선택 입력, 접힌 상태로 시작("메모 남기기" 텍스트 링크 → placeholder
  "남기고 싶은 것" 텍스트필드)
- **"기록하기" 버튼 1개**로 설문(+메모) 제출 → NapRecord.survey/memo 저장 → 홈 복귀
- **"건너뛰기"** 텍스트 링크: 설문 없이도 NapRecord 저장(survey: null)
- 보조 경로 "직접 조정하기"(변경 없음): fast/slow는 latency(0~20분), coffee는
  caffeineOnset(15~35분)을 숫자 입력 + ±스테퍼로 직접 편집 — latency/caffeineOnset을
  바꾸는 유일한 경로(설문 제출과는 별개의 액션)
- 하단 팁 카드: "기지개 → 밝은 빛 → 물 한 잔"
- 후기 화면에서 이탈(앱 종료)해도 크래시 없이 다음 진입 시 홈
- DESIGN_HANDOFF 준수: 세그먼트도 새 색 없이 선택 상태는 ink 배경/흰 글자로 반전만

### 6.5 "파워냅이란?" (정보 화면, 홈에서 텍스트 링크로 진입)

목적: 기본값의 근거를 보여줘 신뢰를 만든다 — 논문 나열이 아니라 "그래서 나는 어떻게
자면 되는가"로 읽히게. 아이콘 없는 텍스트 링크(홈의 "지난 낮잠 기록"/"설정"과 나란히,
원탭 원칙상 3버튼이 여전히 시선 중심). 뒤로가기 = 홈 복귀.

스크롤 화면, 섹션 카드 5개(각 3문장, "연구에 따르면" 수준 — 논문 인용 나열 금지):
1. 왜 10~20분인가(수면 관성, 10분/30분 비교 연구)
2. 언제 자야 하나(이른 오후 1~3시, 크로노타입 개인차)
3. 커피냅은 왜 효과적인가(카페인 발현 20~30분 + 낮잠 겹침)
4. 깨어난 뒤 30초(즉시 기상 → 기지개 → 빛 → 물, 기상 체크리스트와 같은 순서)
5. 낮잠은 밤잠을 대신하지 않는다(보완일 뿐, 하루 1~2회 제한)

작성 규칙: 장기 건강효과(치매 예방 등) 주장 금지, 진단/치료 표현 금지, 하단에 일반
수면 위생 정보 고지문. 수치는 BACKLOG.md 문헌 근거 섹션이 단일 출처 — 그 섹션을
고치면 이 화면도 함께 갱신(BACKLOG.md에 동기화 규칙 명시).

---

## 7. MVP 스코프

> 아래는 최초 착수 시점의 스냅샷 — "OUT" 항목 중 홈 위젯·낮잠 히스토리·온보딩·다국어·
> 서버/계정(AI 분석)은 이후 실제로 구현·출시됐다(STATUS.md 참조). 이 절은 그대로 두고
> 신규 세션은 현재 스코프 판단을 STATUS.md/BACKLOG.md에서 확인할 것.

**IN**: 위 4화면, 3모드 학습(fast/slow/coffee), 플랫폼별 알람 레이어(§4), 햅틱, 다크모드, 로컬 영속화
**OUT (기록만)**: 잠금화면/홈 위젯, 낮잠 히스토리 통계, 수면 사운드, 온보딩, 다국어, 서버/계정
상세는 BACKLOG.md 참조.

---

## 8. Phase별 작업 순서 (Claude Code 실행 단위)

- **Phase 0 — 스캐폴딩**: `npx create-expo-app` (TypeScript), expo-router 구조, 디자인 토큰 파일(`src/theme.ts`), AsyncStorage 래퍼(`src/store.ts`). 빈 4화면 라우팅까지.
- **Phase 1 — 홈 + 학습 상태**: Settings 로드/저장, 실시간 시계, 버튼 2개에 오프셋/기상시각 계산 표시.
- **Phase 2 — 수면 + 알람 코어**: ActiveNap 생명주기, 절대시각 카운트다운, keep-awake, 알림 백업 예약/취소, 백그라운드 복귀 시 상태 복원, expo-audio 알람(무음모드 무시 확인 — **실기기 테스트 필수**), 햅틱 반복.
- **Phase 3 — 알람 해제 슬라이드 + 후기**: 슬라이드 제스처(Reanimated/Gesture Handler), 후기 3버튼 → 오프셋 반영 → 토스트.
- **Phase 4-1 — 학습 엔진 개편**: 4버킷 오프셋(모드×커피), 적응형 스텝(±3→±2), clamp 10~35, 커피 토글 알람 재계산, 후기 화면 "직접 조정하기" 보조 경로, NapRecord append-only 기록 시작.
- **Phase 4-2 — 학습 모델 v2 + 커피냅 3모드**: 데이터 모델을 "기준시각+소요시간"으로 개편
  (`latency`/`caffeineOnset`), 커피냅을 독립 모드로 승격(수면 화면 토글 제거, 홈 화면 칩 UI),
  v3 마이그레이션, 후기 화면 동적 스텝 라벨·학습 상태 캡션. Android 네이티브 알람(위 §4)도
  이 단계 이전에 별도로 앞당겨 도입됨.
- **Phase 4-3 — 후기 설문 개편 + 학습 로직 단순화**: 자동 ±스텝 조정/converged 폐지,
  latency/caffeineOnset은 수동 조정(설정 화면·후기 화면 "직접 조정하기")으로만 변경.
  후기 화면을 3버튼에서 4문항 설문(자세/소음/빛/만족도)+선택 메모로 개편, "건너뛰기" 경로
  추가. NapRecord v2 스키마(survey/memo/manualAdjust), 히스토리는 v1/v2 포맷 모두 렌더.
- **Phase 4-4 — 폴리시**: 다크모드, Dynamic Type, reduced-motion, 접근성 라벨, 엣지케이스(권한 거부, 자정 넘김, 후기 미입력 이탈).
- **Phase 5 (MVP 이후)**: 네이티브 알람(AlarmKit / setAlarmClock) 조사, 잠금화면 위젯. 상세는 BACKLOG.md 참조.

각 Phase 완료 기준: 실기기(Expo Go 또는 dev client)에서 해당 플로우가 끝까지 동작.

---

## 9. 테스트 체크리스트 (Phase 2가 핵심)

- [ ] iOS 무음 스위치 ON 상태에서 포그라운드 알람 소리 재생
- [ ] 앱 백그라운드 전환 → 알람 시각 → 로컬 알림 발화
- [ ] 앱 강제 종료 → 재실행 시 ActiveNap 복원 (미래면 수면 화면, 과거면 알람 화면)
- [ ] 낮잠 취소 시 예약된 알림도 취소됨
- [ ] 설정 화면에서 대기시간을 하한/상한 너머로 연타해도 clamp(latency 0~20,
      caffeineOnset 15~35) 유지
- [ ] 12:50에 20분 낮잠 → 오후 1:10 표기 정상 (자정/정오 경계)
