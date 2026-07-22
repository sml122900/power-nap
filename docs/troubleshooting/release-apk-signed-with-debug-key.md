# 릴리즈 APK가 debug 키로 서명되던 문제

## 문제상황

release configuration 전환(`SHOW_TEST_BUTTONS=false`, `REVENUECAT_STORE='play'`)
커밋 후 릴리즈 빌드를 실기기에 설치해 확인하던 중, Play Console 업로드 전
서명 상태를 확인해보자는 이야기가 나왔다. `android/app/build.gradle`을 열어보니
`buildTypes.release`가 `signingConfigs.debug`를 그대로 쓰고 있었고,
`apksigner verify --print-certs`로 실제 APK를 확인해도
`CN=Android Debug, OU=Android, O=Unknown`이었다 — Expo bare 템플릿 기본값이
방치된 상태로, 이 상태로는 Play에 업로드할 수 없었다.

## 시도한 것들

1. keystore를 새로 만들기 위해 `keytool -genkeypair`를 세션 안(`!` 프리픽스,
   harness가 중계하는 터미널)에서 실행 — 비밀번호 프롬프트가 입력을 아예 못
   받고 매번 빈 문자열로 처리돼("6자 미만") 3회 실패 후 잠김. harness가 중계하는
   콘솔이 keytool의 마스킹 입력(`Console.readPassword()`)에 필요한 실제 TTY를
   제공하지 못하는 것으로 판단, **Claude Code 세션과 완전히 분리된 별도 터미널
   창**에서 직접 실행하도록 전환 — 이후부터는 정상 작동.
2. PowerShell에서 따옴표로 감싼 실행파일 경로(`"C:\...\keytool.exe" -genkeypair`)를
   그냥 호출하면 `-genkeypair`를 "예기치 않은 토큰"으로 파싱 에러 — 호출 연산자
   `&`를 앞에 붙여 해결(`& "C:\...\keytool.exe" ...`).
3. keystore 비밀번호에 한글을 입력해 `PKCS12KeyStore` 생성이
   `InvalidKeySpecException: Password is not ASCII`로 실패 — PKCS12 형식은
   비밀번호가 ASCII 전용이라는 게 원인, 영문+숫자로 재입력해 해결.
4. `gradlew assembleRelease`가 `JAVA_HOME is not set`으로 실패 — 이 개발 환경엔
   시스템 PATH에 `java`가 없었다. Android Studio가 번들로 갖고 있는 JBR
   (`C:\Program Files\Android\Android Studio\jbr`)을 찾아 `JAVA_HOME`으로
   지정해 우회.
5. 새 keystore로 재서명한 APK를 기존 설치본 위에 그냥 설치하려 하니
   `INSTALL_FAILED_UPDATE_INCOMPATIBLE`(서명 인증서가 다른 앱은 덮어쓰기 불가,
   Android 표준 보안 동작) — 기존 debug-서명 앱을 `adb uninstall`로 먼저
   지운 뒤 재설치해 해결.

## 최종 해결법

`plugins/withReleaseSigning.js`(config plugin)를 새로 작성해 매 prebuild마다
release keystore로 서명하도록 `build.gradle`을 패치하고, keystore 파일 자체는
리포 바깥(`C:\Users\<user>\keys\...`)에 두어 `android/`가 재생성돼도 서명 설정이
영구적으로 유지되게 만들었다. 상세 아키텍처 근거는
`docs/decisions/release-signing-config-plugin.md` 참고.

## 이력서 소재 한 줄

배포 직전 실기기 서명 인증서를 직접 검증(`apksigner verify --print-certs`)해
프레임워크 기본값(디버그 키 서명)이 방치된 채 배포 임박까지 놓쳐있던 문제를
사전에 잡아내고, `android/`가 빌드마다 재생성되는 구조적 제약까지 감안해
config plugin으로 서명 설정을 코드화함으로써 재발이 구조적으로 불가능하게 만듦.
