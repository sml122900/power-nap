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

**마지막 검증된 커밋: HEAD (`git log --oneline -1`) — "feat: adaptive learning engine (4-bucket offsets, coffee nap)".**
tsc/expo-doctor/expo export 3종 통과. 아래 "Phase 4-1 실기기 확인" 항목은 아직 미검증.

## 지금 단계

도그푸딩 대기 — 코드 동결 중. 신규 기능은 [BACKLOG.md](BACKLOG.md) 참조, 치명 버그(알람 불발급)만 즉시 수정.
Phase 4-2(다크모드/Dynamic Type 등 폴리시)는 별도 세션에서 진행 예정.

## 미해결 항목

- [ ] 실기기 3종 확인: 슬라이드 해제 / 2연속 소리 / 롱프레스
- [ ] `sound: 'default'` 수정 검증 (기존 설치 채널은 재설치 전까지 경고가 남을 수 있음 — 삭제 후 재설치로 확인 필요)
- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] Phase 4-1 실기기 확인 (신규):
  - [ ] 기존 설치 위에 새 빌드 설치 시 학습값이 유지되는지 (구형→4버킷 마이그레이션 실증)
  - [ ] 수면 중 커피 토글 ON/OFF 시 알람 시각·알림 재예약이 정확한지 (알림이 중복/유령으로 남지 않는지)
  - [ ] 커피냅 후기가 커피 버킷(fastCoffee/slowCoffee)에만 반영되고 비커피 버킷은 그대로인지

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
