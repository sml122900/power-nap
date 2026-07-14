# RevenueCat Test Store가 릴리즈 빌드에서 앱을 강제 종료시키던 문제

## 문제상황

EXPO_PUBLIC 키 인라인 문제를 고친 뒤 릴리즈 APK를 다시 설치했는데도
RevenueCat 초기화가 "Wrong API Key ... app will close to protect security
of test purchases"라는 메시지와 함께 앱을 강제 종료시켰다. 사용자가 "이게
SDK의 의도된 동작으로 보인다 — 테스트 키는 디버그 빌드 전용"이라는
가설을 세우고 문서 확인을 요청했다.

## 시도한 것들

1. RevenueCat 공식 Test Store 문서와 커뮤니티 포럼(GitHub 이슈 포함)을
   WebSearch/WebFetch로 확인 — "Never submit an app to the App Store or
   Google Play that is configured with a Test Store API key"가 명시돼
   있고, 커뮤니티 답변들도 "release build에서 Test Store 키를 쓰면 SDK가
   경고 다이얼로그를 띄우고 크래시시킨다"를 반복해서 확인해줬다. 공식
   우회 방법은 없었다 — Debug Build Configuration(또는 그걸 복제한
   커스텀 설정)에서만 Test Store가 동작하도록 설계된 보안 장치였다.
2. "그럼 디버그 빌드로 바꾸면 끝인가"로 넘어가기 전에, 실수로 이 상태
   그대로 릴리즈가 나가면 사용자가 똑같이 겪을 크래시라는 점을
   짚었다 — 재발 방지책이 필요하다고 판단.

## 최종 해결법

- `npx expo run:android`(디버그 variant)로 전환해 Test Store 검증을
  이어갔다 — `gradlew assembleRelease`로는 애초에 검증이 불가능한
  조합이었다.
- `src/purchases.ts`의 `resolveApiKey()`에 런타임 가드를 추가: `REVENUECAT_STORE
  === 'test'`인데 `__DEV__`가 `false`(릴리즈 빌드)면, RevenueCat SDK가
  크래시내기 전에 우리 쪽에서 먼저 "src/config.ts의 REVENUECAT_STORE를
  play로 바꿔야 한다"는 명확한 에러를 던지도록 했다. `__DEV__`가 정확히
  SDK가 내부적으로 참조하는 것과 같은 디버그/릴리즈 신호라 별도 빌드
  설정 조회 없이 재사용 가능했다.
- CLAUDE.md 지뢰 목록에 이 제약과 해결 방법을 기록.

## 이력서 소재 한 줄

증상만 보고 "설정을 되돌리면 되겠다"로 바로 가지 않고 공식 문서·커뮤니티
사례로 이게 라이브러리의 의도된 보안 장치임을 먼저 확정한 뒤, 재발 방지를
위해 SDK가 참조하는 것과 같은 런타임 신호(`__DEV__`)로 선제적 에러 처리를
추가해 향후 같은 실수가 훨씬 더 알아보기 쉬운 형태로 드러나게 만듦.
