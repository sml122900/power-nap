# STATUS — 세션 핸드오프

## 완료 Phase

- Phase 0: 스캐폴딩 (expo-router, 디자인 토큰, AsyncStorage 래퍼, 4화면 라우팅)
- Phase 1: 홈 화면 (실시간 시계, 학습된 오프셋, 분 단위 재계산 알람 버튼)
- Phase 2 / 2.1: 수면 + 알람 코어, 알람 신뢰성 보강 (expo-audio, expo-notifications 백업 알람, watchdog 훅)
- Phase 3: 슬라이드 해제 제스처 + 후기 피드백 루프
- 보강 커밋: 오디오 released-object 크래시 수정, prebuild 설정 영속화(오디오 플러그인 옵션·불필요 권한 제거), 커피 토글 대비 수정 + dev 10초 테스트 알람, 알림 사운드 경고 수정, tsconfig 안정화(typedRoutes)

**마지막 검증된 커밋: `35418cd`** (docs: add session journal, tech decision, and troubleshooting records)

## 지금 단계

도그푸딩 대기 — 코드 동결 중. 신규 기능은 [BACKLOG.md](BACKLOG.md) 참조, 치명 버그(알람 불발급)만 즉시 수정.

## 미해결 항목

- [ ] 실기기 3종 확인: 슬라이드 해제 / 2연속 소리 / 롱프레스
- [ ] `sound: 'default'` 수정 검증 (기존 설치 채널은 재설치 전까지 경고가 남을 수 있음 — 삭제 후 재설치로 확인 필요)
- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
