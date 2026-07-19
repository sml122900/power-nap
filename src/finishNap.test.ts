jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// 실제 expo-alarm-module/expo-notifications는 jest 환경에 네이티브 모듈이 없어
// "not linked" 에러를 던진다 — finalizeNapCleanup 테스트는 그 두 함수의 실제 네이티브
// 호출이 아니라 저장소 정리 로직(멱등성 포함)이 관심사라 모듈 전체를 목으로 대체한다.
jest.mock('./notifications', () => ({
  stopNativeAlarmSoundAsync: jest.fn().mockResolvedValue(undefined),
  cancelAlarmNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

import { finalizeNapCleanup, resolveFinishNapDestination } from './finishNap';
import { getActiveNap, getPendingFeedback, type ActiveNap } from './store';

describe('resolveFinishNapDestination', () => {
  it('goes to the wake routine first when it is enabled', () => {
    expect(resolveFinishNapDestination(true)).toBe('/wake-stretch');
  });

  it('skips straight to feedback when the wake routine is off', () => {
    expect(resolveFinishNapDestination(false)).toBe('/feedback');
  });
});

describe('finalizeNapCleanup', () => {
  const NAP: ActiveNap = {
    mode: 'fast',
    startedAt: 0,
    alarmAt: 1_200_000,
    notificationId: 'powernap-alarm',
    notificationPermissionGranted: true,
  };

  it('clears ActiveNap and records pending feedback', async () => {
    const destination = await finalizeNapCleanup(NAP, false);
    expect(destination).toBe('/feedback');
    expect(await getActiveNap()).toBeNull();
    expect(await getPendingFeedback()).toMatchObject({ mode: 'fast' });
  });

  it('is safe to run twice on the same nap — mirrors a normal dismiss racing a stray watchdog tick', async () => {
    // finalizeNapCleanup은 setItem 덮어쓰기/removeItem으로만 이뤄져 있어 같은 active로
    // 두 번 불려도(정상 슬라이드 해제와 watchdog의 고아-알람 정리가 겹치는 경우) 두
    // 번째 호출이 에러를 던지거나 상태를 이상하게 만들지 않아야 한다.
    const first = await finalizeNapCleanup(NAP, false);
    const second = await finalizeNapCleanup(NAP, false);
    expect(second).toBe(first);
    expect(await getActiveNap()).toBeNull();
  });

  it('clears ActiveNap even when there is nothing to clean up', async () => {
    const destination = await finalizeNapCleanup(null, true);
    expect(destination).toBe('/wake-stretch');
    expect(await getActiveNap()).toBeNull();
  });
});
