# 릴리즈 빌드 경로를 사용자 프로필 밖 ASCII 경로로 고정

## Problem

Windows 사용자 프로필 폴더명이 `sm553`에서 `이성민`으로 바뀐 뒤 첫 릴리즈 빌드에서
서로 무관해 보이는 세 곳이 한꺼번에 깨졌다(증상별 상세는
`docs/troubleshooting/non-ascii-profile-breaks-release-build.md`).

- `expo prebuild`가 템플릿 전개 직후 segfault (`%TEMP%`가 비ASCII)
- `.env`의 `RELEASE_KEYSTORE_PATH`가 가리키던 keystore가 경로째 소멸
- `gradlew bundleRelease`가 worklets prefab에서 실패 (AGP가 생성한 `.bat`에
  비ASCII gradle 캐시 경로가 박혀 cmd.exe가 못 읽음)

세 증상 모두 "빌드가 갑자기 안 된다"로 나타나지만 원인 계층이 다르다 — 하나는
Node의 파일시스템 처리, 하나는 우리 설정 파일, 하나는 AGP가 생성하는 배치 파일이다.
공통점은 **경로가 사용자 프로필 폴더를 지나간다**는 것 하나뿐이었다.

프로필명은 앞으로도 바뀔 수 있고(계정 이름 변경·재설치·다른 PC로 이전), 비ASCII
프로필명 자체는 한국어 Windows에서 기본값에 가깝다. 즉 "이번에 고쳤다"로 끝나면
같은 유형이 반복된다.

## Action

증상마다 개별 우회를 넣는 대신, **릴리즈 빌드가 건드리는 경로 전부를 프로필 폴더
밖 ASCII 경로로 옮긴다**는 하나의 규칙으로 통일했다.

1. **keystore** — `C:\keys\power-nap\power-nap-release.keystore`.
   드라이브 루트 아래 ASCII 경로라 프로필명 변경과 무관하다. 리포 안에 두지 않는
   기존 원칙(`docs/decisions/release-signing-config-plugin.md`)은 그대로 유지 —
   `android/`는 `expo prebuild --clean`으로 통째로 재생성되기 때문.
   경로만 고치고 끝내지 않고 **검증 빌드를 1회 완주**해 새 경로로 실제 서명이
   되는지 확인했다.

2. **`GRADLE_USER_HOME`** — `C:\gradle-home` (기존 캐시 4.6GB 복사).
   AGP의 prefab 단계가 gradle 캐시 경로를 `.bat` 파일 안에 그대로 써넣기 때문에,
   캐시 위치 자체가 ASCII여야 한다. 우리 코드가 아니라 AGP가 생성하는 파일이라
   코드 수정으로는 못 막는다.

3. **`TMP`/`TEMP`** — `C:\tmp\expo-pb`.
   `expo prebuild`가 템플릿을 임시 디렉터리에 전개한 뒤 프로젝트로 옮기는데,
   그 임시 경로가 비ASCII면 죽는다.

4. **체크리스트로 고정** — 위 3개를 `CLAUDE.md` 릴리즈 체크리스트의 "빌드 전
   환경변수" 블록으로 명문화하고, 지뢰 목록에 세 증상을 **한 항목으로 묶어** 기록했다.
   증상이 제각각이라 따로 적으면 다음에 하나만 만났을 때 같은 원인인 줄 모른다.

**영구 환경변수 등록은 하지 않기로 했다.** 사용자 레벨 `JAVA_HOME`/`GRADLE_USER_HOME`을
등록하면 이 PC의 다른 프로젝트 12개가 전부 영향을 받는다(머신 기본값은 Adoptium
JDK 21인데 power-nap이 검증된 건 Microsoft JDK 17). 세션마다 블록을 실행하는
쪽이 부작용 범위가 좁아 그대로 두고, 대신 "새 터미널에서는 JDK 21로 돌아간다"는
사실을 체크리스트에 명시했다.

## Result

- 새 경로로 릴리즈 AAB 빌드 성공 — `jar verified.` / `CN=SungMin-Lee`,
  versionCode 2 / versionName 1.0.0, 이전 빌드와 산출물 크기 동일(82,743,157 B).
- keystore 사본 4벌이 md5 `da022fdd4420110f322a6d7fe1c0af73`로 일치하고,
  백업본에서 `keytool -list`가 `powernap-release` 엔트리를 정상적으로 연다.
- 프로필명이 또 바뀌어도 세 경로 모두 영향받지 않는다. 다른 PC로 옮길 때도
  같은 3줄만 맞추면 된다.

## 남은 리스크

`C:\keys`와 `E:\프로젝트 백업\keys`는 **같은 PC 안**이다. 기기 도난·화재·전체
장애에는 둘 다 같이 사라지고, 그 경우 복구 경로는 새 패키지명 재출시뿐이다.
오프사이트 1부(클라우드 암호화 또는 집 밖 외장 매체)는 아직 확보되지 않았다.
