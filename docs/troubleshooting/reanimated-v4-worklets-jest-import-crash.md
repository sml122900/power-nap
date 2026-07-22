# Reanimated v4(Worklets 분리 구조)가 jest에서 import 시점에 크래시하던 문제

## 문제상황

홈 위젯 딥링크 진입 로직(`app/index.tsx`의 `handleWidgetModeEntry`)을 검증하려고
`src/homeWidgetMode.test.tsx`를 새로 작성했다. `renderRouter`(`expo-router/testing-library`)로
`HomeScreen`을 실제로 렌더해 검증하려 했는데, 렌더는커녕 **`import HomeScreen from
'../app/index'` 한 줄만으로** 다음 에러가 났다:

```
TypeError: Cannot read properties of undefined (reading 'loadUnpackers')
  at react-native-worklets/src/WorkletsModule/NativeWorklets.native.ts
```

## 시도한 것들

1. `app/index.tsx:262`의 `FadeIn.duration(CHIP_ANIM_MS)`가 범인이라 짐작 —
   `chipAnim`이 매 렌더마다 `reduceMotion` 값(비동기 `AccessibilityInfo` 확인 전엔
   `false`)에 따라 무조건 계산되는 패턴이라, 렌더 단계에서 애니메이션 빌더가
   호출되는 게 문제로 보였다.
2. `jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))`
   추가 — 여전히 같은 줄에서 크래시. 즉 패키지가 공식 제공하는 `/mock` export
   자체가 문제였다.
3. 스택을 끝까지 따라가니 크래시가 **렌더 시점이 아니라 import 시점**에 나고
   있었다. 이 프로젝트의 Reanimated는 4.5.0(Worklets가 `react-native-worklets`로
   분리된 신 아키텍처) — 패키지 자체의 `/mock` 모듈도 내부적으로 진짜 네이티브
   초기화 코드를 재귀적으로 import하는 구조라, jest(네이티브 바인딩 없음) 아래서는
   `/mock`을 써도 크래시를 피할 수 없었다. jest-dynamic-import-async-storage.md와
   달리 이번엔 "무엇을 mock했는지"가 아니라 **패키지의 mock 자체가 이 버전에서
   깨져 있다**는 게 근본 원인.

## 최종 해결법

두 갈래로 대응했다:

- **테스트 대상 자체를 분리**: `HomeScreen`을 렌더해서 검증하는 대신, 위젯 진입
  로직을 컴포넌트 바깥 모듈 스코프 함수 `handleWidgetModeEntry`(의존성은 전부
  콜백으로 주입)로 이미 분리해뒀던 구조를 그대로 활용 — `resolveNapRoute` 등
  이 프로젝트에 기존하던 "렌더 불가능한 화면은 순수/주입형 함수로 로직만 뺀다"
  패턴과 동일.
- **그래도 `app/index.tsx`를 import는 해야 해서** (`handleWidgetModeEntry`가 그
  파일에 있으므로), 패키지의 `/mock`을 버리고 테스트 파일 안에서 직접 최소
  mock을 작성했다 — `Animated.View`/`FadeIn`/`FadeInDown`/`FadeOut.duration()`만
  제공하는 factory:
  ```ts
  jest.mock('react-native-reanimated', () => {
    const RN = require('react-native');
    const animationBuilder = () => ({ duration: () => animationBuilder() });
    return {
      __esModule: true,
      default: { View: RN.View },
      FadeIn: animationBuilder(),
      FadeInDown: animationBuilder(),
      FadeOut: animationBuilder(),
    };
  });
  ```
  `app/index.tsx`가 `@/store`를 통해 AsyncStorage도 모듈 스코프에서 끌어오므로
  `@react-native-async-storage/async-storage/jest/async-storage-mock`도 함께
  필요했다(이 부분은 기존 프로젝트 관행 그대로).

## 이력서 소재 한 줄

같은 패키지가 공식으로 제공하는 `/mock`을 신뢰하지 않고 에러가 실제로 어느
시점(렌더가 아니라 import)에서 나는지부터 스택으로 재확인해, "테스트를 어떻게
mock할까"가 아니라 "테스트 대상 자체를 렌더 불가능한 컴포넌트에서 분리할 수
있는가"로 문제를 재정의해 우회했다.
