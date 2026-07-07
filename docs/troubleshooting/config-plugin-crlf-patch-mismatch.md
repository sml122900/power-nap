# config plugin의 네이티브 소스 패치가 아무 에러 없이 조용히 실패하던 문제

## 문제상황

`expo-alarm-module`의 `Helper.java`에 `setFullScreenIntent()` 호출을 주입하는 config
plugin(`withFullScreenAlarmIntent.js`)을 작성한 뒤 `expo prebuild --clean`을 실행하면
매번 "패치 대상 코드를 찾지 못했습니다"라는, 코드에 직접 넣어둔 에러로 즉시 실패했다.
분명 대상 파일과 문자열을 직접 눈으로 확인했는데도 매칭에 실패했다.

## 시도한 것들

1. **1차 가설 — 문자열 자체가 틀림**: 패치 코드의 `ORIGINAL_SNIPPET` 상수와 실제
   `Helper.java`의 해당 줄을 `sed -n`/`cat -A`로 나란히 출력해 비교했다. 육안으로는
   완전히 동일해 보였다.
2. Node 스크립트로 직접 `fs.readFileSync`한 두 문자열을 `JSON.stringify`로 찍어
   바이트 단위까지 비교했다 — 그제서야 실제 라이브러리 파일 쪽에 `\r\n`(CRLF)이
   섞여 있고, 패치 코드의 템플릿 리터럴은 `\n`(LF)만 갖고 있다는 걸 확인했다.
   `cat -A`가 이 리포(Git Bash on Windows) 환경에서 `\r`을 `^M`으로 표시해주지
   않아서 1차 확인에서 놓쳤던 것.

## 최종 해결법

멀티라인 문자열을 통째로 `.includes()`/`.replace()`하는 방식 자체가 개행 문자
불일치에 취약하다고 판단해, **줄 단위로 스플라이스하는 방식**으로 바꿨다:

```js
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const lines = source.split(/\r\n|\n/); // 개행 문자와 무관하게 줄 단위로 쪼갬
// ...각 줄을 trim해서 비교, 매칭되면 splice로 삽입...
fs.writeFileSync(helperPath, patchedLines.join(eol)); // 원래 파일의 개행 스타일 유지
```

이러면 대상 파일이 LF든 CRLF든(Windows에 설치된 npm 패키지가 CRLF인 경우가 실제로
있었다) 매칭이 항상 성공하고, 쓸 때도 원본의 개행 스타일을 그대로 보존해 불필요한
diff 노이즈도 만들지 않는다.

## 이력서 소재 한 줄

멀티라인 문자열의 정확한 일치 실패를 육안 비교로 넘기지 않고 바이트 단위 비교로
파고들어 CRLF/LF 혼용이라는 플랫폼 특성 문제를 특정했고, 문자열 전체 매칭 대신
줄 단위 파싱으로 패치 로직을 재설계해 OS/설치 경로에 무관하게 동작하도록 만들었다.
