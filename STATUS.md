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

**마지막 검증된 커밋: HEAD (`git log --oneline -1`) — "Merge branch 'spike/native-alarm' into main" (`918c3ee`).**
tsc/expo-doctor/expo export 3종 + jest 11개 통과(브랜치에서), 병합 후 `main` push 완료.

## 지금 단계

Android 네이티브 알람 전환이 `main`에 병합·배포 완료됐고, 이 릴리즈 빌드가 **도그푸딩
3기 기준 버전**이다. 풀스크린 인텐트/화면 자동점등 패치는 별도 브랜치에서 다음 지시로
진행 예정 — 지금은 착수하지 않음. 그 외 신규 기능은 [BACKLOG.md](BACKLOG.md) 참조, 코드
동결 유지.

## 미해결 항목

- [ ] (다음 단계, 별도 브랜치·별도 지시 대기) 풀스크린 인텐트 + 화면 자동점등 네이티브 패치
      — Expo config plugin으로 `MainActivity`에 `turnScreenOn`/`showWhenLocked` 플래그 +
      알림에 `setFullScreenIntent()` 주입 필요(라이브러리가 기본 제공 안 함)
- [ ] 수면 화면 커피 토글 OFF 상태 "켜면 오후 h:mm 알람 (n분)" 프리뷰 값 실기기 재검증
      (버그 3건 수정에 포함됐으나 네이티브 알람 작업에 밀려 별도 확인 안 됨)
- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] Phase 4-1 실기기 확인 (신규):
  - [ ] 기존 설치 위에 새 빌드 설치 시 학습값이 유지되는지 (구형→4버킷 마이그레이션 실증)
  - [ ] 수면 중 커피 토글 ON/OFF 시 알람 시각·알림 재예약이 정확한지 (알림이 중복/유령으로 남지 않는지)
  - [ ] 커피냅 후기가 커피 버킷(fastCoffee/slowCoffee)에만 반영되고 비커피 버킷은 그대로인지

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
