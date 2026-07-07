# STATUS — 세션 핸드오프

## 완료 Phase

- Phase 0: 스캐폴딩 (expo-router, 디자인 토큰, AsyncStorage 래퍼, 4화면 라우팅)
- Phase 1: 홈 화면 (실시간 시계, 학습된 오프셋, 분 단위 재계산 알람 버튼)
- Phase 2 / 2.1: 수면 + 알람 코어, 알람 신뢰성 보강 (expo-audio, expo-notifications 백업 알람, watchdog 훅)
- Phase 3: 슬라이드 해제 제스처 + 후기 피드백 루프
- 보강 커밋: 오디오 released-object 크래시 수정, prebuild 설정 영속화(오디오 플러그인 옵션·불필요 권한 제거), 커피 토글 대비 수정 + dev 10초 테스트 알람, 알림 사운드 경고 수정, tsconfig 안정화(typedRoutes)
- Phase 4-1: 학습 엔진 개편 — 4버킷 오프셋(모드×커피 독립 학습), 적응형 스텝(미수렴 ±3분 →
  "딱 좋았어요" 이후 ±2분), clamp 10~35, 구형 {fast,slow} 설정 자동 마이그레이션,
  수면 화면 커피 토글 시 alarmAt 재계산 + 백업 알림 재예약, 후기 화면 "직접 조정하기"
  ±1분 스테퍼 보조 경로, NapRecord append-only 기록 시작, 패치 버전 드리프트 6건 해소.
  단위 테스트 11개(jest-expo) 통과.
- 낮잠 히스토리 화면 (BACKLOG v1.1에서 사용자 요청으로 코드 동결 중 선반영): 홈 화면
  "지난 낮잠 기록" 링크 → `/history`, `NapRecord` 읽기 전용 목록 표시. `format.ts`에
  `formatKoreanDateTime` 추가. 신규 데이터 기록/학습 로직 변경 없음(열람 전용).
- 도그푸딩 버그 3건 수정 (커밋 `11890c7`): 알림 채널 ID 버전업(`alarm`→`alarm-v2`,
  구채널 설정 고정 문제 — CLAUDE.md 지뢰 목록에 규칙 추가), 알람 화면 롱프레스 해제를
  `Pressable.onLongPress` → `Gesture.LongPress()`로 교체(RNGH 응답 시스템 레이스 회피),
  수면 화면 커피 토글 오프 상태에 프리뷰 텍스트("켜면 오후 h:mm 알람 (n분)") 추가.
  학습 로직/버킷 구조는 건드리지 않음.
- 테스트 버튼 노출을 `__DEV__` 게이트에서 `src/config.ts`의 `SHOW_TEST_BUTTONS` 플래그로
  전환 (커밋 `657d6ab`) — 도그푸딩 중엔 릴리즈 빌드에서도 노출되도록 기본 `true`.
  **정식 출시 전 반드시 `false`로 변경 확인할 것** (CLAUDE.md 코드 규칙에 체크리스트 추가).
- 도그푸딩 버그 3건 실기기 재검증 완료: 알림 채널 v2 정상 생성·소리/진동 ON. 단, 백그라운드/
  잠금 상태에선 진동만 나고 소리가 없어 "진짜 알람" 요구사항으로 확정 → Android 네이티브
  알람 조기 도입 결정.
- **Android 네이티브 알람 전환 완료** (`expo-alarm-module`, `STREAM_ALARM`) — `spike/native-alarm`
  브랜치에서 작업 후 `main`에 병합됨. PROJECT.md §4 참고:
  - `src/notifications.ts` Android 분기를 `expo-alarm-module`로 교체(고정 UID, showDismiss/
    showSnooze 끔), `app/alarm.tsx`는 Android에서 expo-audio 재생을 끄고 화면/햅틱/해제만
    담당, `app/_layout.tsx`의 `ensureAndroidChannelAsync` 제거(라이브러리가 자체 채널 생성).
  - **실기기 검증 전 항목 통과**: New Architecture 릴리즈 빌드 링크, 무음+볼륨0 관통 연속
    재생, 포그라운드/백그라운드/잠금 전부에서 발화, 알림 탭→해제 화면 진입, 슬라이드/롱프레스
    해제, 낮잠취소, 커피토글 재예약, 2연속 낮잠, **앱 강제종료 상태에서도 알람 발화**(가장
    중요한 시험) 전부 확인됨.
  - 롱프레스는 중간에 완전 미작동 발견 → `Gesture.LongPress()` 기본 `maxDistance`(~10pt)가
    3초 유지 기준으로 너무 빡빡했던 것 + 별도 텍스트 링크가 사용자가 누르는 지점과 분리돼
    발견성도 나빴음. `maxDistance(40)` + 롱프레스를 슬라이드 손잡이 자체에
    `Gesture.Race(pan, longPress)`로 결합해 재확인 완료.
  - **의도적으로 미룬 것 3건(다음 단계 후보, PROJECT.md §4 "알려진 한계" 참고)**:
    풀스크린 인텐트/화면 자동점등 미구현(알림 본문을 직접 탭해야 해제 화면 진입), 알림 스와이프
    삭제 시 화면 없이 소리 꺼짐, 커스텀 사운드(`alarm.wav`) 미지원(라이브러리 기본음 사용).
- **학습 모델 v2 + 커피냅 3모드** (`main`에 병합 완료) — PROJECT.md §5·§6,
  BACKLOG.md "구현됨(Phase 4-2)"/"카페인 발현시간 근거" 참고:
  - 데이터 모델 v3: `offsets` 4버킷 → `latency{fast,slow}`(0~20분) + `caffeineOnset`
    (15~35분, 기본 25분)로 교체. `coffee: boolean` 필드 폐지, `NapMode`에 `'coffee'` 3번째
    값 추가. v1/v2 → v3 마이그레이션(caffeineOnset은 구형 커피 버킷 값 승계 안 함, 항상
    기본값에서 재시작 — 사용자 확정).
  - 수면 화면 커피 토글 완전 제거(재예약 코드 포함) — 커피 여부/시각은 홈 화면에서 낮잠
    시작 전에 이미 확정.
  - 홈 화면에 "커피냅" 버튼 추가, 탭하면 기존 3버튼 아래로 칩 4개(방금/5분전/10분전/
    직접입력)가 펼쳐짐(토글, ≤150ms 애니메이션). 프리셋은 즉시 시작, 직접입력만 숫자입력+
    실시간 미리보기+확정 버튼 예외 경로. `computeCoffeeAlarmAt`으로 "이미 카페인이 돌고
    있음" 보정(now+10분) 처리.
  - 후기 화면 3버튼 라벨을 실제 스텝으로 동적 표시(기존 ±5 하드코딩 버그 함께 수정 —
    Phase 4-1 스텝 개편 이후 라벨이 안 갱신됐던 문제), 학습 상태 캡션 추가, "직접
    조정하기"가 latency/caffeineOnset을 모드에 맞게 직접 편집.
  - jest 20개 통과(기존 11개 + 마이그레이션/3모드 학습/보정로직 신규 9개), tsc/expo-doctor/
    expo export 3종 통과.

- **도그푸딩 발견 5건 수정 + 설정 화면 (A그룹, `main`에 병합 완료)**:
  - A-0 조사: 홈 버튼 fast(35분) > slow(30분) 역전은 v3 마이그레이션 버그 아님(코드
    전수 확인, mode 매핑 이상 없음) — 도그푸딩 중 테스트 낮잠(10초/1분 버튼)이 전부
    fast 모드로 latency.fast를 오염시킨 결과로 판정. `ActiveNap`/`NapRecord`에 `isTest`
    플래그 추가 → 테스트 낮잠은 후기 화면을 건너뛰고 학습 미반영, 히스토리에 "테스트"
    배지만 표시. 기존 오염값은 코드로 되돌리지 않음 — A-4 설정 화면에서 사용자가 직접
    교정 필요(fast 대기시간이 실제보다 부풀려져 있음).
  - 홈 화면 ScrollView + KeyboardAvoidingView 전환 — 커피냅 칩/직접입력 펼침 시
    작은 화면에서 잘리거나 키보드에 가리는 문제 해결, 펼침 시 자동 스크롤.
  - Android 뒤로가기 정리: 알람 화면은 하드웨어 뒤로가기 완전 차단(해제는 슬라이드/
    롱프레스만), 후기 화면은 뒤로가기 시 홈으로(알람 화면 복귀 방지). 수면 화면은
    기존 기본 동작이 이미 안전해 코드 변경 없음(백그라운드 전환돼도 네이티브 알람이
    낮잠을 책임짐).
  - 알람 해제 롱프레스 인식 영역을 손잡이(56pt)에서 슬라이드 트랙 전체+안내 문구로
    확대(도그푸딩에서 롱프레스 실패 리포트 반영).
  - 설정 화면(`/settings`) 신규: 수면 대기시간(잠듦/뒤척임, 0~20분)·카페인 발현시간
    (15~35분)을 스테퍼+숫자입력으로 직접 조정, 항목별 "20 + n = 총 n분" 미리보기.
    `applyManualAdjustment` 재사용(converged 유지), NapRecord에 `manual-settings`로
    기록(후기 화면의 `manual` 경로와 구분). 홈 화면 "지난 낮잠 기록" 옆에 "설정" 링크.
  - jest 21개 통과, tsc/expo-doctor/expo export 3종 통과. 커밋 3개로 분리
    (`fix: isolate test naps...` / `fix: home overflow, back nav, long-press hitbox` /
    `feat: settings screen (A-4)`).
  - **실기기 검증 완료**(디버그 빌드, Metro 포트 8080 연결): 뒤로가기 차단/이동, 롱프레스
    트랙 확장, 설정 화면 전부 정상 확인. 확인 과정에서 커피냅 직접입력 시 Android
    키보드가 입력창/미리보기/확정 버튼을 가리는 추가 버그 발견·수정 —
    `KeyboardAvoidingView`의 Android `behavior`를 `adjustResize`에만 맡기지 않고
    `'height'`로 명시 + 포커스 시 지연 스크롤(`fix: coffee custom-input panel hidden
    behind Android keyboard`). 겸사겸사 패치 버전 드리프트 3건(`expo`/`expo-linking`/
    `expo-router`)도 `expo install --fix`로 해소.
  - **`main`에 병합 완료** (merge commit `2f36363`, 커밋 6개 전부 포함). 병합 후
    main에서 tsc/expo-doctor/expo export/jest 4종 재검증 통과.

- **Phase 4-3 — 자동 조정 학습 폐지 + 4문항 설문 후기 화면** (`phase-4-3` 브랜치,
  `main` 기준 분기, **main 미병합**) — PROJECT.md §5·§6·§8, BACKLOG.md "구현됨(Phase 4-3)"/
  "학습 구조 전환 근거" 참고:
  - `applyFeedback`/`converged`/적응형 스텝 전부 삭제. latency/caffeineOnset을 바꾸는
    경로는 수동 조정(설정 화면, 후기 화면 "직접 조정하기")뿐 — 근거: 만성 수면부족
    사용자의 "부족함" 피드백은 수면부채 신호일 수 있어 자동 조정은 과잉 반응 위험.
  - 후기 화면 3버튼 → 4문항 설문(자세 편안함/소음 차단/빛 차단/수면 만족도, 각
    상·중·하, 기본값 '중')+선택 메모+"기록하기" 제출 버튼+"건너뛰기"(그래도 기록은
    저장, survey: null). 설문 응답은 latency/caffeineOnset에 영향 없음(순수 데이터
    수집, 향후 BACKLOG v2 분석 원료).
  - NapRecord v2 스키마(`survey`/`memo`/`manualAdjust`)를 기존 v1(`result`/
    `manualAdjustmentMinutes`) 옆에 추가 — 과거 기록 변경·삭제 없이 히스토리에서
    양쪽 포맷 모두 렌더. `history.tsx`의 `detailText`/`surveySummary`는 직접 단위
    테스트하도록 export.
  - jest 22개 통과(store 17개 + history 5개, 신규 `app/history.test.ts`), tsc/
    expo-doctor/expo export 3종 통과. 커밋 2개(`refactor: replace auto-adjustment...`
    / `docs: reflect Phase 4-3...`), push 완료. **실기기 미검증, main 미병합**.

**마지막 검증된 커밋: `38e5330` — "docs: reflect Phase 4-3 learning-model + survey redesign", `phase-4-3` 브랜치.**

## 브랜치 현황

- `main`: 네이티브 알람 + 학습 모델 v2 + 커피냅 3모드 + A그룹 전부 병합 완료,
  실기기 검증까지 끝낸 최신 상태.
- `phase-4-2`: main에 병합 완료 — 더 이상 별도로 갈 일 없음(정리 대상, 삭제는
  사용자 지시 시).
- `fullscreen-intent`: `main` 기준으로 분기, config plugin 구현+컴파일 검증 완료
  (릴리즈 빌드까지 준비됨), `main`(A그룹 포함) 병합도 완료 — `app/alarm.tsx` 충돌
  없이 자동 병합됨. **실기기 검증 대기**.
- `phase-4-3`: `main` 기준으로 분기, 학습 로직 단순화 + 후기 설문 개편 구현·검증 3종+
  jest 통과, push 완료. **실기기 검증 대기, main 미병합**.

## 지금 단계

세 갈래 다 검증/병합 대기 중:
- `fullscreen-intent`(B그룹): 구현 완료, 릴리즈 APK 빌드까지 준비됨. **실기기 설치는
  사용자 지시 대기**(아직 설치 안 함).
- `phase-4-3`: 구현 완료, 검증 3종+jest 통과. **실기기 검증 대기**.

그 외 신규 기능은 [BACKLOG.md](BACKLOG.md) 참조, 코드 동결 유지.

## 미해결 항목

- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] `phase-4-2` 브랜치 정리(삭제) — main 병합 완료로 더 이상 필요 없음, 삭제는 사용자 확인 후

## B그룹 — 풀스크린 인텐트 (`fullscreen-intent` 브랜치, `main` 기준 분기)

- [x] config plugin으로 `MainActivity`에 `turnScreenOn`/`showWhenLocked` 플래그 +
      알림에 `setFullScreenIntent()` 주입 + `USE_FULL_SCREEN_INTENT` 권한 +
      `canUseFullScreenIntent()` 런타임 확인 — 구현·컴파일 검증 완료
- [x] `main`(A그룹 포함) 병합 완료 — `app/alarm.tsx` 충돌 없이 자동 병합
- [x] 릴리즈 빌드 준비(`gradlew assembleRelease` 성공, APK 생성)
- [ ] 실기기 설치·검증 — 사용자 지시 대기(잠금 화면 자동 점등, `canUseFullScreenIntent()`
      권한 로그, 폴백 동작, 기존 알림 탭 경로 유지 확인)
- [ ] `fullscreen-intent` → `main` 병합 여부/시점 결정 (실기기 검증 후)

## Phase 4-3 — 학습 로직 단순화 + 후기 설문 (`phase-4-3` 브랜치, `main` 기준 분기)

- [x] `applyFeedback`/`converged`/적응형 스텝 삭제, 수동 조정만 남김
- [x] 후기 화면 4문항 설문+메모+건너뛰기, NapRecord v2 스키마, 히스토리 v1/v2 렌더
- [x] jest 22개 + 검증 3종 통과, push 완료
- [ ] **실기기 검증**: 설문 제출/건너뛰기/메모 저장이 실제로 기록되는지, 세그먼트
      탭 반응·기본값(중) 확인, 설정 화면·"직접 조정하기" 양쪽에서 수동 조정이 여전히
      정상 동작하는지, 히스토리에서 기존(v1) 기록과 신규(v2) 기록이 둘 다 깨지지
      않고 보이는지(기존 AsyncStorage 데이터 위에서 확인 — 마이그레이션 아님, 공존)
- [ ] `phase-4-3` → `main` 병합 여부/시점 결정 (실기기 검증 후)

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
