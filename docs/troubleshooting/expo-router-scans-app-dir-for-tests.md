# `app/` 아래 컴포넌트 테스트가 프로덕션 번들을 깨뜨리던 문제

## 문제상황

설정 화면 컴포넌트 렌더 테스트를 `app/settings.test.tsx`에 추가한 뒤 검증 4종
(tsc/expo-doctor/expo export/jest) 중 `npx expo export --platform ios`가 새로
실패하기 시작했다:

```
Error: Unable to resolve module path from .../node_modules/expo-router/build/testing-library/mock-config.js
```

`path`는 Node.js 코어 모듈이라 React Native 번들(Metro)이 애초에 해석할 수 없다.
jest 실행(`npx jest`)에서는 같은 테스트 파일이 멀쩡히 통과했다는 게 더 헷갈렸다 —
번들링 단계에서만 재현됐다.

## 시도한 것들

1. 에러의 Import stack을 그대로 읽어 원인을 역추적: 테스트 파일이 import한
   `expo-router/testing-library`(`renderRouter` 제공용)가 내부적으로
   `@testing-library/react-native` → 그 안에서 Node의 `path` 모듈을 요구하는
   체인이었다. 즉 테스트 전용 유틸리티가 프로덕션 번들에 실제로 포함되려 하고
   있었다.
2. "왜 테스트 파일이 프로덕션 번들 대상이 되는가?"를 확인 — expo-router는
   `app/` 디렉터리 전체를 `require.context`로 스캔해 라우트를 구성하는데, 이
   스캔이 파일명에 `.test.`가 들어있는지 여부와 무관하게 **`app/` 아래 모든 파일을
   그대로 모듈 그래프에 포함**시킨다는 것을 직접 재현으로 확인했다.
3. 그렇다면 기존에 이미 있던 `app/history.test.ts`는 왜 문제가 없었는지 확인 —
   그 파일은 순수 함수(`detailText` 등)만 테스트하고 Node 전용 모듈을 끌어오는
   import 체인이 우연히 없었을 뿐, 구조적으로는 똑같이 위험했다(운이 좋았을 뿐).

## 최종 해결법

테스트 파일을 `app/settings.test.tsx`에서 `src/settings.test.tsx`로 옮기고,
실제 화면 컴포넌트는 상대 경로(`../app/settings`)로 그대로 import했다. `src/`는
expo-router의 `require.context` 스캔 대상이 아니므로 프로덕션 번들에 전혀
포함되지 않는다 — 테스트 커버리지는 그대로 유지하면서 번들 오염만 제거했다.

## 이력서 소재 한 줄

`expo export` 실패의 표면적 에러 메시지(Node 모듈 리졸브 실패)에서 멈추지 않고
번들러가 애초에 그 파일을 왜 모듈 그래프에 넣었는지(파일 기반 라우팅의
`require.context` 스캔 규칙)까지 추적해, 테스트를 삭제하거나 축소하지 않고
파일 위치만 옮기는 최소 변경으로 근본 해결함.
