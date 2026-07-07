# 풀스크린 인텐트를 config plugin의 소스 패치로 구현 (라이브러리 포크 대신)

## Problem

`expo-alarm-module`(Android 네이티브 알람 레이어)은 `AudioManager.STREAM_ALARM` 연속
재생은 이미 구현돼 있었지만, 잠금/화면 꺼짐 상태에서 알람 시각에 화면을 자동으로 켜고
해제 화면으로 직행시키는 `setFullScreenIntent()`는 지원하지 않았다. 알림을 사용자가
직접 탭해야만 앱이 열리는 구조라 "진짜 알람" 경험에 못 미쳤다.

라이브러리 소스(`Helper.java`)를 확인하니 `NotificationCompat.Builder` 체이닝에
`.setFullScreenIntent(...)` 호출 자체가 없고, 이 값을 주입할 수 있는 옵션도 JS 쪽에
노출돼 있지 않았다 — 즉 라이브러리를 고치지 않고는 addressable 확장 지점이 없었다.

## Action

두 가지 선택지를 검토했다:

1. **라이브러리 포크**: `expo-alarm-module`을 fork해 패치를 반영하고 그 fork를
   `package.json`에서 참조. 장점은 정상적인 패키지 형태를 유지한다는 것이지만, fork
   저장소를 별도로 관리해야 하고, 원본 라이브러리의 향후 업데이트를 받으려면 매번
   수동으로 리베이스해야 하는 유지보수 부담이 있다.
2. **config plugin 안에서 `node_modules`를 직접 패치**: Expo config plugin의
   `withDangerousMod`는 `expo prebuild` 실행 시 프로젝트 루트에 대한 임의 코드 실행을
   허용한다. 이 훅 안에서 `node_modules/expo-alarm-module/.../Helper.java`를 읽어
   `.setFullScreenIntent(...)` 호출을 문자열 삽입으로 주입하고 다시 쓰는 방식 — 사실상
   `patch-package`를 config plugin 안에 내장한 것과 같다.

2번을 채택했다. 근거:

- fork 관리 오버헤드가 없다 — 패치 로직 자체가 리포에 커밋된 일반 JS 파일
  (`plugins/withFullScreenAlarmIntent.js`)이라 리뷰·버전 관리가 그대로 된다.
- `expo prebuild --clean`을 몇 번을 다시 돌려도, `npm install`로 라이브러리가
  pristine 상태로 되돌아가도 매번 자동으로 재적용된다 — fork였다면 `package.json`의
  참조를 fork로 바꾸는 걸 잊거나 fork가 낡는 리스크가 있다.
- 리스크는 라이브러리 버전이 바뀌면 문자열 매칭이 깨질 수 있다는 것 — 이를 완화하려고
  패치 함수가 "이미 패치됨" 마커를 확인해 멱등적으로 스킵하되, 매칭 대상 코드를 못
  찾으면 **조용히 스킵하지 않고 에러를 던지도록** 설계했다(버전 결합을 `expo-alarm-module@1.2.0`
  기준으로 코드에 명시). 이러면 라이브러리 업그레이드 시 빌드가 바로 실패해 패치가
  깨졌다는 걸 놓치지 않는다.

매니페스트 변경(`USE_FULL_SCREEN_INTENT` 권한, `MainActivity`의 `showWhenLocked`/
`turnScreenOn`)은 소스 패치가 필요 없는 순수 매니페스트 속성이라 `withAndroidManifest`로
분리했다 — 실제 소스 코드 패치가 필요한 부분(`setFullScreenIntent()` 호출 자체)만
`withDangerousMod`를 썼다.

## Result

`expo prebuild --clean`을 연속 두 번 실행해 멱등성(중복 패치 없음)을 확인했고,
`expo-alarm-module`을 강제로 pristine 재설치한 뒤에도 패치가 정상 재현되는 것을
확인했다. `gradlew assembleDebug`/`assembleRelease`로 패치된 Java가 실제로
컴파일되는지 검증한 뒤, 릴리즈 APK를 실기기에 설치해 화면 꺼짐/잠금 상태에서의 자동
점등을 확인했다.

이 패턴 자체도 하나의 재사용 가능한 결론이다 — Expo 프로젝트에서 서드파티 네이티브
모듈이 필요한 훅을 안 열어줄 때, fork를 만들기 전에 "config plugin의
`withDangerousMod`로 소스를 텍스트 레벨로 패치할 수 있는가"를 먼저 검토할 가치가 있다.
