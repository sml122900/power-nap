# 컴포넌트 렌더 테스트에서 `await import(...)`가 jest-expo에서 크래시하던 문제

## 문제상황

설정 화면에 이 프로젝트 첫 컴포넌트 렌더 테스트(`@testing-library/react-native`)를
추가했더니, 화면이 마운트되며 실행하는 `useEffect` 안에서 다음 에러가 났다:

```
TypeError: A dynamic import callback was invoked without --experimental-vm-modules
```

`@react-native-async-storage/async-storage`는 이미 `jest.mock`으로 목 처리해둔
상태였는데도 발생했다. 같은 에러가 세션 후반, 설정 화면에 "명언 목록 편집" 기능을
추가하며 `getMissionQuotes`/`setMissionQuotes`용 테스트를 새로 작성할 때도 똑같이
재현됐다.

## 시도한 것들

1. `jest.mock('@react-native-async-storage/async-storage', ...)`을 테스트 파일
   최상단에 추가 — 이미 있었는데도 실패가 계속됨. 즉 문제는 "무엇을 import하는지"가
   아니라 **`import()` 문법 자체**였다.
2. 에러 스택을 따라가 실제 호출부를 확인 — `src/i18n.ts`의 `getLanguagePreference`가
   `const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;`
   형태의 지연 동적 import를 쓰고 있었다(이 파일을 순수 함수만 테스트하려는 다른
   테스트 파일이 네이티브 모듈 목킹 없이도 깨지지 않게 하려는 의도적 설계였다).
3. jest-expo의 프리셋 설정(`getPlatformPreset.js`)을 읽어, babel-jest 트랜스폼에
   `caller: { name: 'metro', bundler: 'metro', ... }`를 넘긴다는 걸 확인 — 이는
   실제 Metro 번들 타깃과 동일한 caller 시그니처라, babel-preset-expo가 "네이티브
   dynamic import를 지원하는 환경"으로 판단해 `import()`를 CommonJS
   `require()`로 변환하지 않고 그대로 남겨둔다. Jest는 기본적으로 CJS 환경이라
   `--experimental-vm-modules` 없이는 네이티브 `import()`를 실행할 수 없다.

## 최종 해결법

같은 근본 원인이지만 두 파일에서 다르게 대응했다:

- **설정 화면 렌더 테스트**: `getLanguagePreference`/`setLanguagePreference`를
  호출하는 `useEffect`가 있는 채로 화면을 렌더해야 했으므로, 이 두 함수를 통째로
  `jest.mock('@/i18n', () => ({ ...jest.requireActual('@/i18n'), getLanguagePreference: jest.fn()... }))`
  로 우회했다. 근본적인 dynamic import 트랜스폼 문제는 이 테스트의 범위 밖이라
  고치지 않았다.
- **명언 저장 함수(`src/missionQuotes.ts`)**: 여기서는 우회가 아니라 근본 회피가
  가능했다 — 애초에 지연 import 패턴의 목적("AsyncStorage 없이 순수 함수만 도는
  테스트를 보호")이 이 파일에는 적용되지 않았다. 이 파일의 유일한 테스트 파일이
  이미 새로 추가한 `getMissionQuotes`/`setMissionQuotes` 테스트 때문에
  AsyncStorage를 전역으로 목 처리하고 있었기 때문이다. 그래서 `await import(...)`를
  버리고 파일 최상단에서 정적으로 `import AsyncStorage from '@react-native-async-storage/async-storage'`로
  바꿨다 — 코드가 더 단순해지고 이 버그 자체를 완전히 피했다.

## 이력서 소재 한 줄

동일한 에러 메시지가 두 곳에서 재현됐을 때 둘 다 같은 방식(모킹)으로 덮지 않고,
각 파일이 애초에 지연 로딩 패턴을 도입한 이유(테스트 보호 범위)를 다시 검토해 —
한쪽은 우회가 최선이고 다른 한쪽은 패턴 자체가 불필요했다는 걸 구분해 서로 다른
해결책(모킹 vs 구조 변경)을 선택함.
