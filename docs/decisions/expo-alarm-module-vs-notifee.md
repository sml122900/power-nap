# Android 네이티브 알람 라이브러리로 expo-alarm-module 채택 (Notifee 대신)

## Problem

실기기 도그푸딩에서 Android 백업 알림이 앱이 백그라운드/잠금 상태일 때 진동만 울리고 소리가
전혀 나지 않는 문제가 발견됐다. 원인을 추적한 결과 근본적으로 일반 로컬 알림은 무음모드나
미디어 볼륨 0 상태를 우회할 수 없는 구조였다 — "진짜 알람"처럼 동작하려면 Android의
`AudioManager.STREAM_ALARM`으로 직접 재생하는 네이티브 레이어가 필요했다(PROJECT.md에는
이미 Phase 5 후보로 적혀 있었으나 앞당겨야 하는 상황이 됐다).

당초 후보로 짚었던 라이브러리는 `Notifee`(`@notifee/react-native`)였다 — 업계에서 널리 쓰이고
`fullScreenAction`/`AndroidCategory.ALARM` 등 알람 앱에 필요한 API를 갖추고 있다고 알려져 있었다.

## Action

Notifee를 실제로 조사하러 GitHub 저장소를 직접 열어본 결과, **2026-04-07에 저장소가
아카이브되어 더 이상 유지보수되지 않는다**는 배너를 발견했다. 마지막 릴리즈는 2024년
12월(v9.1.8)로, 아카이브 훨씬 전부터 이미 정체돼 있었다. 공식 후속 권장은 커뮤니티 포크
`react-native-notify-kit` 또는 `expo-notifications`(알람 전용 기능 없음)였다.

이 사실 하나로 원래 계획("Notifee 채택 가능성 조사")의 전제가 무너져, 대안을 다시
비교했다:

- **`react-native-notify-kit`**: Notifee 포크, Expo config plugin 있음, `SET_EXACT_AND_ALLOW_WHILE_IDLE`
  기반 — 다만 여전히 어린 단일 관리자 프로젝트라 bus-factor 리스크가 있고, 알람 오디오 엔진
  (STREAM_ALARM 재생용 포그라운드 서비스)은 어느 쪽을 택하든 직접 짜야 하는 부분이었다.
- **`expo-alarm-module`(Nidilap)**: 처음부터 알람 앱 전용으로 설계돼 `FOREGROUND_SERVICE_MEDIA_PLAYBACK`,
  `SCHEDULE_EXACT_ALARM` 등을 이미 매니페스트에 포함하고, 실제 소스(`Sound.java`)를 읽어
  `MediaPlayer.setAudioStreamType(STREAM_ALARM)` + `setLooping(true)`로 알람 스트림 연속재생을
  이미 구현해둔 것을 확인했다 — 가장 어려운 부분(오디오 엔진)이 이미 있는 상태.
- **`vall370/expo-alarm`**: "AlarmManager+AlarmKit" 표방이 솔깃했으나 열어보니 ★1, config plugin
  없음, 풀스크린 인텐트/포그라운드 서비스 문서 자체가 없어 사실상 미완성 — 제외.
- **`alperengozum/expo-alarm`**: OS 기본 시계 앱에 위임하는 방식이라 우리 자체 해제 화면을
  못 띄움 — 요구사항 자체를 충족 못 해 제외.

`expo-alarm-module`을 채택하되, 전체를 신뢰하지 않고 먼저 별도 브랜치(`spike/native-alarm`)에서
가장 위험한 두 가정만 스파이크로 검증했다: (1) New Architecture(Expo SDK 57 필수) 릴리즈
빌드가 실제로 링크되는지, (2) `STREAM_ALARM` 재생이 실기기에서 무음모드+미디어볼륨0을 정말
관통하고 연속 재생되는지. 두 항목 모두 실기기 확인 후에야 본 구현(JS 연동, 소리 책임 이관)에
들어갔다.

## Result

New Architecture 빌드 링크, 무음+볼륨0 관통, 포그라운드/백그라운드/잠금 전 상태 발화,
앱 강제 종료 상태에서의 발화까지 실기기로 전부 확인했다. 다만 소스 코드 검토로 이 라이브러리가
`setFullScreenIntent()`/화면 자동 점등은 구현하지 않았다는 것도 사전에 파악해 문서화했다
(PROJECT.md §4 "알려진 한계") — 다음 단계에서 별도 네이티브 패치가 필요함을 미리 알고 시작한
것과, 나중에 발견해 되짚어야 하는 것의 차이를 만들었다.

핵심 교훈: 유명하다고 알려진 라이브러리도 "지금 아카이브 상태인지"는 실제로 저장소를 열어
확인해야 한다 — 검색 결과 요약이나 과거 지식만으로는 이런 급변 사항을 놓치기 쉽다.
