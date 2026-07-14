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

## 후속(2026-07-15) — 예측했던 `app/history.test.ts` 위험이 실제로 터짐

위 3번에서 "구조적으로는 똑같이 위험하지만 운이 좋았을 뿐"이라고 남겨둔
`app/history.test.ts`가 몇 주 뒤 실제로 실기기 디버그 빌드에서
"Property 'jest' doesn't exist" 크래시를 냈다 — 이번엔 Node 전용 모듈이
아니라 최상단 `jest.mock(...)` 호출 자체가 원인이었다.

**중요한 차이 하나가 새로 드러났다**: 이번엔 `expo export --platform ios`도
`--platform android`도 둘 다 통과했다(직접 재현: 옛 파일을 잠깐 복원해
두 플랫폼 export를 재실행). `jest.mock(...)`만 있는 파일은 문법적으로
멀쩡하고 Node 전용 import도 없어서 Metro가 번들링 자체는 문제없이
끝낸다 — `expo export`는 번들이 "만들어지는지"만 검증하지 "실행되는지"는
확인하지 않기 때문이다. `jest`라는 전역이 없다는 `ReferenceError`는 그
코드가 실제로 **실행되는 순간**(앱 부팅 시 `require.context`가 즉시
require할 때)에만 발생한다.

즉 "expo export 통과 여부"는 이 지뢰를 잡아주는 신뢰할 수 있는 안전망이
아니다 — Node 전용 의존성이 있는 파일(예: `expo-router/testing-library`)만
빌드 시점에 걸리고, 순수 전역 호출만 있는 파일은 실행해봐야만 드러난다.
`find app -iname "*.test.*"`로 직접 확인하는 게 유일하게 믿을 수 있는
검증이라는 결론을 CLAUDE.md 지뢰 목록에도 반영했다.
