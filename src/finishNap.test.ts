jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { resolveFinishNapDestination } from './finishNap';
import type { ActiveNap } from './store';

const BASE_NAP: ActiveNap = {
  mode: 'fast',
  startedAt: 0,
  alarmAt: 1000,
  notificationId: null,
  notificationPermissionGranted: true,
};

describe('resolveFinishNapDestination', () => {
  it('goes to the wake routine first when it is enabled', () => {
    expect(resolveFinishNapDestination(BASE_NAP, true)).toBe('/wake-stretch');
  });

  it('skips straight to feedback when the wake routine is off', () => {
    expect(resolveFinishNapDestination(BASE_NAP, false)).toBe('/feedback');
  });

  it('sends test naps home regardless of the wake routine setting', () => {
    const testNap: ActiveNap = { ...BASE_NAP, isTest: true };
    expect(resolveFinishNapDestination(testNap, true)).toBe('/');
    expect(resolveFinishNapDestination(testNap, false)).toBe('/');
  });

  it('falls back to the wake-routine-enabled destination when there is no active nap record', () => {
    expect(resolveFinishNapDestination(null, true)).toBe('/wake-stretch');
    expect(resolveFinishNapDestination(null, false)).toBe('/feedback');
  });
});
