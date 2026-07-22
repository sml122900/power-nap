// 홈 위젯(S/M/L) 딥링크(powernap:///?widgetMode=fast|slow|coffee) 진입 처리 테스트.
// resolveWidgetModeAction 자체의 판정 테스트는 store.test.ts에 있다 — 여기서는
// handleWidgetModeEntry(app/index.tsx)가 그 판정 결과를 실제 동작(startNap/coffee 패널/
// 이미낮잠중 안내)에 올바르게 연결하는지, 특히 재탭 가드(이미 ActiveNap이 있으면
// onStartNap을 호출하지 않는지)를 확인한다. HomeScreen 자체는 렌더하지 않는다 —
// reduceMotion 초기값(false)에서 FadeIn.duration()을 무조건 계산해 이 프로젝트에
// 아직 없는 reanimated의 entering/exiting 애니메이션 목이 필요해지기 때문(다른 렌더
// 테스트들은 이 API를 안 써서 문제가 없었음). handleWidgetModeEntry는 컴포넌트 함수
// 바깥의 순수 접합 함수라 이 문제와 무관하게 임포트·호출 가능하다. 다만 app/index.tsx를
// import하는 순간 그 파일의 다른 최상단 import(react-native-reanimated, AsyncStorage
// 기반의 @/store)도 같이 로드된다.
// react-native-reanimated@4(Worklets 분리 이후) 자체 제공 목(`react-native-reanimated/mock`)이
// require 시점에 네이티브 워클릿 모듈 초기화를 그대로 타 jest에서 죽는다(이 프로젝트
// 버전 한정 — 프로젝트에 아직 이 진단이 문서화 안 돼 있었음) — app/index.tsx가 실제로
// 쓰는 것(Animated.View, FadeIn/FadeInDown/FadeOut.duration())만 최소로 직접 목한다.
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
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { handleWidgetModeEntry } from '../app/index';
import type { ActiveNap } from './store';

function makeDeps(activeNap: ActiveNap | null) {
  return {
    getActiveNap: jest.fn(async () => activeNap),
    onAlreadyNapping: jest.fn(),
    onOpenCoffeePanel: jest.fn(),
    onStartNap: jest.fn(),
  };
}

describe('handleWidgetModeEntry — 홈 위젯 딥링크 진입 접합', () => {
  it('ActiveNap이 없을 때 fast/slow → onStartNap(mode) 호출', async () => {
    const deps = makeDeps(null);
    await handleWidgetModeEntry('fast', deps);
    expect(deps.onStartNap).toHaveBeenCalledWith('fast');
    expect(deps.onAlreadyNapping).not.toHaveBeenCalled();
    expect(deps.onOpenCoffeePanel).not.toHaveBeenCalled();
  });

  it('ActiveNap이 없을 때 coffee → onOpenCoffeePanel만 호출 (새 화면 아님, onStartNap 안 부름)', async () => {
    const deps = makeDeps(null);
    await handleWidgetModeEntry('coffee', deps);
    expect(deps.onOpenCoffeePanel).toHaveBeenCalledTimes(1);
    expect(deps.onStartNap).not.toHaveBeenCalled();
  });

  it('재탭 가드: 이미 ActiveNap이 있으면 모드 무관하게 onAlreadyNapping만 호출 — onStartNap/onOpenCoffeePanel 절대 안 부름', async () => {
    const existing: ActiveNap = {
      mode: 'slow',
      startedAt: Date.now(),
      alarmAt: Date.now() + 30 * 60_000,
      notificationId: 'existing-notification',
      notificationPermissionGranted: true,
    };

    for (const mode of ['fast', 'slow', 'coffee'] as const) {
      const deps = makeDeps(existing);
      await handleWidgetModeEntry(mode, deps);
      expect(deps.onAlreadyNapping).toHaveBeenCalledTimes(1);
      expect(deps.onStartNap).not.toHaveBeenCalled();
      expect(deps.onOpenCoffeePanel).not.toHaveBeenCalled();
    }
  });
});
