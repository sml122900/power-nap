# 릴리즈 keystore를 리포 바깥에 두고 config plugin으로 서명 설정 주입

## Problem

릴리즈 빌드를 실제 기기에 설치하려고 `apksigner verify --print-certs`로 확인해보니
`CN=Android Debug`로 서명돼 있었다 — Expo bare 템플릿이 생성하는
`android/app/build.gradle`은 `buildTypes.release.signingConfig`가
`signingConfigs.debug`를 그대로 가리키게 돼 있다(디버그 키, Play 업로드 불가).

직접 `build.gradle`을 고쳐 release keystore를 가리키게 하는 방법은 이 프로젝트에서
쓸 수 없다 — `android/`는 `.gitignore`돼 있고 `expo prebuild --clean`으로 통째로
재생성되는 디렉터리라(CLAUDE.md 원칙), 손으로 고친 서명 설정은 다음 clean prebuild에서
그대로 사라진다. keystore 파일 자체도 절대 이 안에 두면 안 된다 — 같은 이유로
삭제되거나, `.gitignore` 예외 처리에 실수가 생기면 리포에 커밋될 위험까지 있다.

## Action

기존에 이미 있던 config plugin 패턴(`plugins/withFullScreenAlarmIntent.js` 등,
prebuild마다 재적용되는 네이티브 코드/매니페스트 패치)을 그대로 따라
`plugins/withReleaseSigning.js`를 새로 만들었다:

1. **keystore는 리포 완전히 바깥**(`C:\Users\<user>\keys\power-nap-release.keystore`)에
   둔다 — `.gitignore`가 실수로 안 걸려도 애초에 리포 디렉터리 안에 파일이
   존재하지 않으므로 커밋될 방법이 없다.
2. **경로·별칭·비밀번호 전부 `.env`의 non-`EXPO_PUBLIC_` 변수**로 관리
   (`RELEASE_KEYSTORE_PATH`/`RELEASE_KEY_ALIAS`/`RELEASE_KEYSTORE_PASSWORD`/
   `RELEASE_KEY_PASSWORD`). `EXPO_PUBLIC_` 접두사를 쓰면 babel-preset-expo가 값을
   JS 번들에 리터럴로 박아 넣으므로 반드시 피해야 한다.
3. plugin은 `withAppBuildGradle` mod로 매 prebuild마다 `signingConfigs.release`
   블록을 삽입하고 `buildTypes.release.signingConfig`를
   `signingConfigs.debug` → `signingConfigs.release`로 재배선한다. 정규식으로
   `signingConfigs {` 블록과 `release { ... signingConfig signingConfigs.debug }`
   블록을 찾아 패치하며, 둘 중 하나라도 못 찾으면(템플릿이 바뀐 경우) 조용히
   스킵하지 않고 에러를 던진다.
4. **네 변수 중 하나라도 비어있으면 prebuild 자체를 실패**시킨다 — "값이 없으면
   그냥 debug로 서명"이 아니라 "값이 없으면 빌드가 안 된다"로 만들어, 릴리즈가
   조용히 디버그 키로 서명된 채 배포되는 사고를 원천 차단했다.

## Result

`expo prebuild --clean` → 릴리즈 재빌드 → `apksigner verify --print-certs`로
`CN=SungMin-Lee, OU=lifebook, O=lifebook`(실제 릴리즈 인증서)임을 확인 —
더 이상 `Android Debug`가 아니다. keystore 파일과 비밀번호는 리포 히스토리
어디에도 존재하지 않고, 이 plugin과 `.env.example`(변수명만, 값은 없음)만
커밋됐다. `android/`를 몇 번을 지우고 다시 만들어도(`expo prebuild --clean`)
서명 설정은 매번 자동으로 복원된다 — 수동 개입이 필요 없다.
