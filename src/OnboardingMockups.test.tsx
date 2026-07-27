// 온보딩 목업(app/onboarding.tsx) 렌더 존재 확인 — 정적 목업이라 로직 검증은 없고,
// 4개 컴포넌트가 예외 없이 마운트되는지만 스냅샷 수준으로 지킨다.
// reanimated 4.5.0의 워클릿 네이티브 모듈은 jest 환경에 없어 그대로 import하면 던진다
// (saveActiveNapOrRollback.test.tsx와 같은 이유 — 공식 mock.js도 같은 초기화 경로를 타서
// 못 쓴다). useSharedValue/useAnimatedStyle을 동기 평가로만 대체하는 최소 목.
jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identity = (v: any) => v;
  return {
    __esModule: true,
    default: { View: RN.View },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSharedValue: (initial: any) => ({ value: initial }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAnimatedStyle: (worklet: () => any) => worklet(),
    withRepeat: identity,
    withSequence: identity,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withDelay: (_delay: number, animation: any) => animation,
    withTiming: identity,
    Easing: { inOut: () => identity, ease: identity },
  };
});

import { render } from '@testing-library/react-native';

import { colors as lightColors } from './theme';
import { Slide1Mockup, Slide2Mockup, Slide3Mockup, Slide4Mockup } from './OnboardingMockups';

describe('OnboardingMockups — 4개 슬라이드 목업이 예외 없이 렌더된다', () => {
  it('Slide1Mockup', () => {
    expect(() => render(<Slide1Mockup colors={lightColors} />)).not.toThrow();
  });

  it('Slide2Mockup', () => {
    expect(() => render(<Slide2Mockup />)).not.toThrow();
  });

  it('Slide3Mockup', () => {
    expect(() => render(<Slide3Mockup colors={lightColors} />)).not.toThrow();
  });

  it('Slide4Mockup', () => {
    expect(() => render(<Slide4Mockup />)).not.toThrow();
  });
});
