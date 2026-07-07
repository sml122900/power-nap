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
- "바로 잠듦 / 뒤척임 / 커피냅" 3모드 독립 관리 (§5)

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
- **알려진 한계 (실기기 검증 대상, 이후 단계에서 네이티브 패치 예정)**:
  - `setFullScreenIntent()`/화면 자동 점등 미구현 — 지금은 알림을 사용자가 직접 탭해야
    해제 화면으로 진입한다. 잠금화면에서 자동으로 화면이 켜지며 해제 화면이 뜨는 것은
    아직 아니다.
  - 알림을 스와이프로 지우면(`setDeleteIntent`) 우리 화면을 거치지 않고 소리가 꺼진다 —
    라이브러리 동작이며 네이티브 패치 없이는 못 막는다.
  - 커스텀 사운드(`assets/sounds/alarm.wav`) 미지원 — 라이브러리가 재생음을 `"default"`로
    하드코딩해서(`Manager.java`) 시스템 기본음이 나간다. 커스터마이즈하려면 네이티브 포크 필요.
- 진동: 네이티브 레이어 자체 진동(연속) + JS `Haptics` 인터벌(양쪽 플랫폼 공통, `alarm.tsx`)이
  중복으로 울릴 수 있음 — 실사용에서 거슬리면 Android 쪽 JS 햅틱 인터벌을 끄는 것을 검토.

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
  Android 풀스크린 인텐트/화면 자동점등 패치는 별도 단계로 이어서 진행 예정(위 "알려진 한계" 참고).

---

## 5. 데이터 모델 & 학습 로직 (Phase 4-3 — 자동 조정 폐지, 수동 조정 + 설문 데이터 수집)

알람 = 기준시각 + 소요시간. 모드별로 기준시각과 소요시간의 의미가 다르다:
- 일반 낮잠(fast/slow): 알람 = 낮잠 시작 + `TARGET_SLEEP_MIN`(상수 20분) + `latency[mode]`(수동 조정)
- 커피냅(coffee): 알람 = 커피 마신 시각(`coffeeDrankAt`) + `caffeineOnset`(수동 조정)

```ts
type NapMode = 'fast' | 'slow' | 'coffee';  // 바로 잠듦 / 뒤척임 / 커피냅
const TARGET_SLEEP_MIN = 20; // 목표 수면시간(분) — 조정 대상 아님, 고정 상수

interface Settings {
  latency: Record<'fast' | 'slow', number>;         // 분, clamp 0~20. 초기값 { fast: 0, slow: 10 }
  caffeineOnset: number;                             // 분, clamp 15~35. 초기값 25
  totalNaps: number;
}

interface ActiveNap {
  mode: NapMode;
  startedAt: number;       // epoch ms — 낮잠(또는 커피냅 확정) 시작 시각
  alarmAt: number;         // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffeeDrankAt?: number;  // epoch ms — mode==='coffee'일 때만
  notificationId: string | null;
}

type SurveyRating = 'high' | 'mid' | 'low'; // 상 / 중 / 하

interface NapSurvey {
  posture: SurveyRating;      // 자세 편안함
  noise: SurveyRating;        // 소음 차단
  light: SurveyRating;        // 빛 차단
  satisfaction: SurveyRating; // 수면 만족도
}

interface NapRecord {  // 후기 제출 시마다 append-only, UI 없음(히스토리/분석 원료)
  completedAt: number;
  mode: NapMode;
  offsetMinutes: number;                 // 이번 낮잠에 실제 사용된 총 시간(분)

  // v1(레거시, Phase 4-2 이전 3버튼 후기) — 신규 레코드는 설정 안 함, 히스토리 하위호환용
  result?: 'tooDeep' | 'justRight' | 'notEnough' | 'manual' | 'manual-settings' | 'test';
  manualAdjustmentMinutes?: number;

  // v2(Phase 4-3)
  survey?: NapSurvey | null;             // "건너뛰기" 제출 시 null
  memo?: string;                          // 선택 메모
  manualAdjust?: {                        // 수동 조정 — latency/caffeineOnset을 바꾸는 유일한 경로
    source: 'feedback' | 'settings';
    beforeMinutes: number;
    afterMinutes: number;
  };
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

## 6. 화면 명세 (4개 화면 — prototype.html 참조)

### 6.1 홈
- 상단: "지금" + 현재 시각(실시간)
- 헤드: "졸리면 / 그냥 누르세요"
- **버튼 3개**:
  - Primary(brand 채움, 128pt+): "바로 잠들 것 같아요" + "{TARGET_SLEEP_MIN+latency.fast}분 뒤 · 오후 h:mm 알람"
  - Secondary(외곽선, 128pt+): "좀 뒤척일 것 같아요" + 동일 포맷
  - 커피냅(amber 계열, 64pt — fast/slow보다 낮은 위계): "커피냅" + "커피 마시고 {caffeineOnset}분 뒤 기상"
- **커피냅 탭 → 인라인 확장**: 기존 3버튼 아래에 프리셋 칩 4개(방금/5분전/10분전/직접입력)가
  펼쳐짐(≤150ms, reduce-motion 시 즉시 표시). 다시 탭하면 접힘(토글). 프리셋 칩은 탭 즉시
  낮잠 시작(원탭 유지) — 알람은 `커피 시각 + caffeineOnset`. 직접입력만 예외: "몇 분 전" 숫자
  입력 + ±스테퍼(0~120분, 기본 0) → 실시간 미리보기("오후 h:mm 알람 (n분 뒤)", 계산 결과가
  이미 과거/60초 이내면 "카페인이 이미 돌고 있어요" 안내와 함께 now+10분으로 보정) → 확정
  버튼으로 시작. 칩 패널이 펼쳐진 채로 1·2번 버튼을 탭하면 칩은 무시하고 그 모드로 즉시 시작.
- 하단: 학습 상태 캡션 1줄

### 6.2 수면
- 배경 night, 호흡 도트(4s, reduced-motion 존중), 카운트다운(76pt, mm:ss)
- 기상 안내: 일반 낮잠 "오후 h:mm에 깨워드릴게요" / 커피냅 "카페인 발현에 맞춰 오후 h:mm에
  깨워드릴게요" — 커피 여부는 홈 화면에서 이미 확정되므로 이 화면엔 토글 없음
- 하단: "그만 자고 일어나기" 고스트 버튼
- keep-awake 활성, 진입 시 알림 백업 예약

### 6.3 알람
- 배경 brand, 링 펄스 애니메이션, "일어날 시간이에요" + "5분 더 자면 수면 관성 때문에 더 멍해져요"
- 커피냅이었으면: "지금부터 카페인 효과가 시작돼요" 배지
- **해제는 탭이 아니라 슬라이드 제스처** (M3 스타일 "밀어서 끄기") — 비몽사몽 오터치 방지.
  슬라이드 손잡이를 3초간 가만히 눌러도 해제(길게 누르기 폴백, 밀기와 같은 손잡이에 결합)
- 슬라이드 완료 전까지 사운드+진동 반복

### 6.4 후기 (Phase 4-3 — 4문항 설문 + 메모로 개편)
- "낮잠 어땠어요?" + 학습 상태 한 줄("내 수면 대기시간: 잠듦 n분 · 뒤척임 n분" 또는
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

---

## 7. MVP 스코프

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
