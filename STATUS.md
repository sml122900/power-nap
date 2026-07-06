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
- **[브랜치 `phase-4-2`, main 미병합] 학습 모델 v2 + 커피냅 3모드** — PROJECT.md §5·§6,
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
    expo export 3종 통과. **`main`에는 아직 병합 안 함**.

**마지막 검증된 커밋: HEAD (`git log --oneline -1`) — phase-4-2 브랜치, 병합 전.**

## 지금 단계

`phase-4-2` 브랜치에서 학습 모델 v2 + 커피냅 3모드 구현 완료, 검증 3종+jest 통과.
**실기기 검증 전** — 아래 미해결 항목 확인 후 병합 여부 결정 필요. 그 외 신규 기능은
[BACKLOG.md](BACKLOG.md) 참조, 코드 동결 유지.

## 미해결 항목

- [ ] **Phase 4-2 실기기 검증 (다음 세션 최우선)**:
  - [ ] 홈 화면 커피냅 버튼 → 칩 펼침/접힘 토글, 2x2 레이아웃 44pt 터치 타겟 확인
  - [ ] 프리셋 칩(방금/5분전/10분전) 탭 시 즉시 낮잠 시작되는지
  - [ ] 직접입력 칩: 숫자 입력, 실시간 미리보기 갱신, 확정 버튼으로 시작
  - [ ] 직접입력에서 큰 "분 전" 값 입력 시 "카페인이 이미 돌고 있어요" 보정 문구 확인
  - [ ] 칩 펼친 상태에서 1·2번(바로 잠듦/뒤척임) 버튼 탭 시 칩 무시하고 즉시 그 모드로 시작
  - [ ] 커피냅 알람이 실제로 `coffeeDrankAt + caffeineOnset`에 맞게 울리는지
  - [ ] 수면 화면: 커피냅일 때 "카페인 발현에 맞춰 ~" 문구, 일반 낮잠은 기존 문구
  - [ ] 후기 화면: 3버튼 라벨의 스텝 숫자가 실제 적용값과 일치하는지(fast/slow/coffee 각각),
        학습 상태 캡션이 모드에 맞게 나오는지("내 수면 대기시간" vs "내 카페인 발현")
  - [ ] "직접 조정하기": fast/slow는 0~20분 범위, coffee는 15~35분 범위로 clamp되는지
  - [ ] 구형 설치(4버킷 offsets) 위에 새 빌드 설치 시 v3 마이그레이션이 학습값을 합리적으로
        이전하는지(fast/slow 값 유지, caffeineOnset은 25분으로 리셋됨을 확인)
- [ ] `phase-4-2` → `main` 병합 여부/시점 결정
- [ ] (다음 단계, 별도 브랜치·별도 지시 대기) 풀스크린 인텐트 + 화면 자동점등 네이티브 패치
      — Expo config plugin으로 `MainActivity`에 `turnScreenOn`/`showWhenLocked` 플래그 +
      알림에 `setFullScreenIntent()` 주입 필요(라이브러리가 기본 제공 안 함)
- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
