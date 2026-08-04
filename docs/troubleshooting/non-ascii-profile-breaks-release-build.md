# Windows 프로필 폴더명이 한글로 바뀌자 릴리즈 빌드가 3군데서 깨진 문제

## 문제상황

프로덕션 제출용 AAB를 만들려고 `versionCode`를 2로 올리고 빌드를 시작했는데,
가장 먼저 `expo prebuild --clean`이 실패했다. 그런데 에러 메시지가 없었다 —
`android/`를 지웠다는 로그와 "Creating native directory (./android)"까지만 찍히고
프로세스가 그냥 죽었다(PowerShell exit 5, Git Bash에서는 `Segmentation fault`,
exit 139). `android/`는 이미 지워진 뒤라 되돌릴 것도 없는 상태였다.

이 프로젝트는 그동안 같은 명령으로 릴리즈 빌드를 여러 번 성공시켰다(가장 최근이
2026-07-23 릴리즈 서명 작업). 코드도 그대로고 node_modules도 그대로인데 갑자기
안 되는 상황이었다.

## 시도한 것들

1. **단순 재시도** — PowerShell/Git Bash 양쪽에서 3회 반복. 매번 정확히 같은
   지점(tar 전개 직후)에서 죽어 transient 문제가 아님을 확인.

2. **`EXPO_DEBUG=1`로 마지막 단계 확인** — 종료 코드만으로는 아무것도 알 수 없어
   디버그 로그를 켰다. 마지막 줄이
   `expo:utils:tar write(644): C:\Users\이성민\AppData\Local\Temp\<hash>\LICENSE`
   였다. tar 전개는 끝났고 그 다음(임시 디렉터리 → 프로젝트 복사)에서 죽는다는 것,
   그리고 경로에 한글이 들어있다는 것을 여기서 처음 봤다.

3. **`TMP`/`TEMP`를 ASCII 경로로** — Git Bash에서 `TMP=C:\\tmp\\expo-pb` 형태로
   넘겼더니 백슬래시가 뭉개져
   `EINVAL: invalid argument, mkdir 'C:\project_2026\power-nap\C:tmpexpo-pb\...'`가
   났다. PowerShell에서 `$env:TMP='C:\tmp\expo-pb'`로 제대로 설정하니 **prebuild 통과**.
   → 원인은 비ASCII `%TEMP%`였다.

4. **keystore 경로 확인** — prebuild가 주입한 `build.gradle`의 `storeFile`이
   `C:/Users/sm553/keys/power-nap-release.keystore`였는데 그 경로가 없었다.
   `C:\Users`를 열어보니 `sm553` 프로필 자체가 없고 `이성민`만 있었다 —
   **프로필 폴더명이 바뀌었다**는 걸 여기서 확정했다. 앞의 segfault와 같은 원인
   계열이라는 것도 이때 연결됐다.

5. **keystore 탐색** — `find /c -iname "*power-nap*.keystore" -o -iname "*.jks"`로
   드라이브 전체를 뒤져 3개를 찾았다(`$Recycle.Bin` 1개, `C:\backup` 2개).
   md5가 셋 다 동일해 같은 파일임을 먼저 확인하고, `keytool -list -v`로
   alias `powernap-release` / `CN=SungMin-Lee` / 생성일 2026-07-23까지 대조해
   진짜 릴리즈 키가 맞다는 걸 확정한 뒤 `.env`를 재지정했다.
   (**잘못된 키로 빌드하면 Play 업로드가 거부되므로 md5 일치만으로 넘어가지 않고
   인증서 지문까지 확인했다.**)

6. **`gradlew bundleRelease`** — 이번엔 6분 돌다가
   `react-native-worklets`의 `prefab_command.bat` 실행이 exit 1로 실패했다.
   gradle 스택트레이스는 `ProcessException: Error while executing process ...
   prefab_command.bat`까지만 보여주고 진짜 이유는 안 알려줬다.

7. **prefab 로그 직접 열기** — `.../cxx/RelWithDebInfo/<hash>/logs/arm64-v8a/`의
   `prefab_stderr.txt`를 읽으니 "지정된 경로를 찾을 수 없습니다" + "'cli.AppKt'는
   내부 또는 외부 명령이 아닙니다"였다. `prefab_command.bat`를 열어보니
   `--class-path "C:\\Users\\이성민\\.gradle\\caches\\..."`가 그대로 박혀 있었다 —
   **AGP가 생성하는 배치 파일**이라 우리 코드로는 못 막는 지점이었다.
   (중간에 로그를 못 찾아 헤맸는데, 앞선 PowerShell `cd android`가 Bash 도구의
   작업 디렉터리에도 남아 상대경로가 어긋난 것이 원인이었다.)

## 최종 해결법

경로 세 개를 전부 사용자 프로필 밖 ASCII 경로로 옮겼다.

```powershell
$env:JAVA_HOME='C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
$env:GRADLE_USER_HOME='C:\gradle-home'   # 기존 캐시 4.6GB robocopy
$env:TMP='C:\tmp\expo-pb'; $env:TEMP='C:\tmp\expo-pb'
```

keystore는 `C:\keys\power-nap\power-nap-release.keystore`를 정식 경로로 확정하고
`.env`의 `RELEASE_KEYSTORE_PATH`를 재지정한 뒤, **검증 빌드를 1회 완주**해 새
경로로 실제 서명이 되는지 확인했다(경로만 고치고 넘어가지 않음).

결과: `app-release.aab` 82,743,157 B, `jar verified.` / `CN=SungMin-Lee`,
versionCode 2 / versionName 1.0.0. 업로드 전 게이트(`SYSTEM_ALERT_WINDOW` /
`DevSettingsActivity` 부재)도 최종 산출물에서 통과.

구조적 근거와 "왜 영구 환경변수로 등록하지 않았는가"는
`docs/decisions/ascii-build-paths-outside-user-profile.md` 참고.
재발 방지는 `CLAUDE.md` 지뢰 목록 + 릴리즈 체크리스트에 기록했다 — 세 증상을
**한 항목으로 묶어** 적었다. 따로 적으면 다음에 하나만 만났을 때 같은 원인인 줄
모르기 때문이다.

## 이력서 소재 한 줄

서로 무관해 보이는 빌드 실패 3건(원인 불명 segfault, 파일 소멸, 네이티브 빌드
실패)을 각각 우회하는 대신 공통 원인(비ASCII 사용자 프로필 경로)을 특정해 경로
정책 하나로 통합 해결하고, 프레임워크가 생성하는 파일이라 코드로 막을 수 없는
지점을 체크리스트로 대체했다.
