# 파워냅 (PowerNap) — 원탭 낮잠 알람 앱

> Claude Code 실행용 스펙 문서. 이 문서와 `powernap-prototype.html`(디자인 레퍼런스)을 레포 루트에 두고 Phase 순서대로 진행한다.

---

## 1. 제품 한 줄 정의

**졸려서 눈이 감기는 순간, 버튼 한 번으로 낮잠 알람을 맞추는 앱.**
사용자는 인지 자원이 바닥난 상태다. 계산·타이핑·음성 명령·메뉴 탐색을 전부 제거한다.

### 핵심 차별점 — 적응형 시간 학습
- 기상 후 3버튼 후기(깊게 잤음 / 딱 좋음 / 부족함) → 다음 낮잠 시간에 **즉시** 반영
- "바로 잠듦 / 뒤척임" 2모드 × 모드별 독립 오프셋 학습

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

3중 레이어:
1. **주 알람 (포그라운드)**: 수면 화면이 떠 있는 동안 JS 타이머 + expo-audio로 최대 볼륨 알람 재생. iOS 무음 모드에서도 재생되도록 오디오 세션 설정. keep-awake로 화면 유지, 수면 화면은 다크(#12172A)로 배터리/눈부심 최소화.
2. **백업 알람 (로컬 알림)**: 낮잠 시작 시 동일 시각에 로컬 알림도 예약. 앱이 백그라운드로 가거나 종료돼도 알림은 울린다. 알람 해제/취소 시 예약 취소.
3. **진동**: 알람 발화 시 Haptics 반복 패턴 병행.

주의사항:
- 낮잠 시작 시 알림 권한 요청(최초 1회). 거부 시 "앱을 켠 채로 두면 알람이 울려요" 안내.
- 앱이 백그라운드에서 복귀했을 때 `alarmAt`이 지났으면 즉시 알람 화면으로 진입 (elapsed-time 체크, JS 타이머 신뢰 금지 — `Date.now()` 기준 절대시각 비교).
- `playsInSilentMode`는 iOS 무음 스위치만 우회할 뿐, 기기의 미디어 볼륨 슬라이더 자체는 우회하지 못한다. 사용자가 미디어 볼륨을 0으로 낮춰 두면 주 알람(레이어 1)은 무음으로 재생된다 — 이 경우 진동(레이어 3)과 백업 로컬 알림(레이어 2, 알림음은 별도 채널/알림 볼륨을 따름)이 그 공백을 메운다. 근본적으로 볼륨 슬라이더를 무시하는 "알람 스트림" 재생은 네이티브 알람 API 영역이라 Phase 5(AlarmManager.setAlarmClock / AlarmKit) 이전에는 해결하지 않는다.
- **Phase 5 (MVP 이후)**: Android `AlarmManager.setAlarmClock` / iOS 26 AlarmKit 네이티브 모듈 조사 후 도입. MVP에서는 하지 않는다.
  - 메모: 현재 `expo-audio` 플러그인은 `enableBackgroundPlayback: false`로 꺼서 `FOREGROUND_SERVICE`/`FOREGROUND_SERVICE_MEDIA_PLAYBACK` 권한이 없다. 네이티브 알람으로 전환할 때(백그라운드에서도 알람음을 직접 재생해야 한다면) 포그라운드 서비스 권한/미디어 세션 서비스 재도입 여부를 재검토할 것.

---

## 5. 데이터 모델 & 학습 로직

```ts
type NapMode = 'fast' | 'slow';  // 바로 잠듦 / 뒤척임

interface Settings {
  offsets: Record<NapMode, number>;  // 분, 초기값 { fast: 20, slow: 30 }
  totalNaps: number;
}

interface ActiveNap {
  mode: NapMode;
  startedAt: number;   // epoch ms
  alarmAt: number;     // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffee: boolean;
  notificationId: string | null;
}
```

학습 규칙 (단순하게, ML 없음):
- 너무 깊게 잤어요 → 해당 모드 offset −5분
- 딱 좋았어요 → 변화 없음
- 아직 부족해요 → +5분
- clamp: **min 10, max 40**
- 반영은 즉시 AsyncStorage 저장 → 다음 홈 진입 시 버튼에 표시

앱 재시작 시 `ActiveNap`이 저장돼 있고 `alarmAt`이 미래면 수면 화면 복원, 과거면 알람 화면으로 진입.

---

## 6. 화면 명세 (4개 화면 — prototype.html 참조)

### 6.1 홈
- 상단: "지금" + 현재 시각(실시간)
- 헤드: "졸리면 / 그냥 누르세요"
- **버튼 2개 (화면의 주인공, 각 128pt+)**:
  - Primary(brand 채움): "바로 잠들 것 같아요" + "{n}분 뒤 · 오후 h:mm 알람"
  - Secondary(외곽선): "좀 뒤척일 것 같아요" + 동일 포맷
- 하단: 학습 상태 캡션 1줄
- ~~커피 토글~~ → **수면 화면으로 이동** (토스 원칙: 홈의 결정은 "언제 잘 것인가" 하나만)

### 6.2 수면
- 배경 night, 호흡 도트(4s, reduced-motion 존중), 카운트다운(76pt, mm:ss), "오후 h:mm에 깨워드릴게요"
- **커피 토글 여기 배치**: "방금 커피 마셨어요" — 켜면 amber 강조 + "깰 때쯤 효과가 시작돼요"
- 하단: "그만 자고 일어나기" 고스트 버튼
- keep-awake 활성, 진입 시 알림 백업 예약

### 6.3 알람
- 배경 brand, 링 펄스 애니메이션, "일어날 시간이에요" + "5분 더 자면 수면 관성 때문에 더 멍해져요"
- 커피 켰으면: "지금부터 카페인 효과가 시작돼요" 배지
- **해제는 탭이 아니라 슬라이드 제스처** (M3 스타일 "밀어서 끄기") — 비몽사몽 오터치 방지
- 슬라이드 완료 전까지 사운드+진동 반복

### 6.4 후기
- "낮잠 어땠어요?" + 3버튼 (각 버튼에 결과 미리 명시: "다음엔 5분 줄일게요")
- 선택 → 저장 → 홈 복귀 + 토스트("다음 낮잠은 15분으로 맞춰둘게요")
- 하단 팁 카드: "기지개 → 밝은 빛 → 물 한 잔"
- 후기 화면에서 이탈(앱 종료)해도 크래시 없이 다음 진입 시 홈

---

## 7. MVP 스코프

**IN**: 위 4화면, 2모드 학습, 3중 알람, 커피 토글, 햅틱, 다크모드, 로컬 영속화
**OUT (기록만)**: 네이티브 알람 모듈, 잠금화면/홈 위젯, 낮잠 히스토리 통계, 수면 사운드, 온보딩, 다국어, 서버/계정

---

## 8. Phase별 작업 순서 (Claude Code 실행 단위)

- **Phase 0 — 스캐폴딩**: `npx create-expo-app` (TypeScript), expo-router 구조, 디자인 토큰 파일(`src/theme.ts`), AsyncStorage 래퍼(`src/store.ts`). 빈 4화면 라우팅까지.
- **Phase 1 — 홈 + 학습 상태**: Settings 로드/저장, 실시간 시계, 버튼 2개에 오프셋/기상시각 계산 표시.
- **Phase 2 — 수면 + 알람 코어**: ActiveNap 생명주기, 절대시각 카운트다운, keep-awake, 알림 백업 예약/취소, 백그라운드 복귀 시 상태 복원, expo-audio 알람(무음모드 무시 확인 — **실기기 테스트 필수**), 햅틱 반복.
- **Phase 3 — 알람 해제 슬라이드 + 후기**: 슬라이드 제스처(Reanimated/Gesture Handler), 후기 3버튼 → 오프셋 반영 → 토스트.
- **Phase 4 — 폴리시**: 다크모드, Dynamic Type, reduced-motion, 접근성 라벨, 엣지케이스(권한 거부, 자정 넘김, 후기 미입력 이탈).
- **Phase 5 (MVP 이후)**: 네이티브 알람(AlarmKit / setAlarmClock) 조사, 잠금화면 위젯.

각 Phase 완료 기준: 실기기(Expo Go 또는 dev client)에서 해당 플로우가 끝까지 동작.

---

## 9. 테스트 체크리스트 (Phase 2가 핵심)

- [ ] iOS 무음 스위치 ON 상태에서 포그라운드 알람 소리 재생
- [ ] 앱 백그라운드 전환 → 알람 시각 → 로컬 알림 발화
- [ ] 앱 강제 종료 → 재실행 시 ActiveNap 복원 (미래면 수면 화면, 과거면 알람 화면)
- [ ] 낮잠 취소 시 예약된 알림도 취소됨
- [ ] "깊게 잤어요" 연타 시 10분 하한 클램프
- [ ] 12:50에 20분 낮잠 → 오후 1:10 표기 정상 (자정/정오 경계)
