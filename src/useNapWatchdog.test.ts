jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { resolveNapRoute } from './useNapWatchdog';
import type { ActiveNap } from './store';

const BASE_NAP: ActiveNap = {
  mode: 'fast',
  startedAt: 0,
  alarmAt: 1000,
  notificationId: null,
  notificationPermissionGranted: true,
};

describe('resolveNapRoute', () => {
  it('goes home when there is no active nap', () => {
    expect(resolveNapRoute(null, false, 500)).toBe('/');
    expect(resolveNapRoute(null, true, 500)).toBe('/');
  });

  it('stays on sleep while alarmAt is still in the future', () => {
    expect(resolveNapRoute(BASE_NAP, false, 999)).toBe('/sleep');
  });

  it('goes straight to alarm once alarmAt has passed when the mission is off', () => {
    expect(resolveNapRoute(BASE_NAP, false, 1000)).toBe('/alarm'); // alarmAt===now boundary
    expect(resolveNapRoute(BASE_NAP, false, 2000)).toBe('/alarm');
  });

  it('routes to the mission screen once alarmAt has passed when the mission is on and not yet completed', () => {
    expect(resolveNapRoute(BASE_NAP, true, 1000)).toBe('/mission');
  });

  it('skips the mission once missionCompleted is true, even with the mission on', () => {
    const nap: ActiveNap = { ...BASE_NAP, missionCompleted: true };
    expect(resolveNapRoute(nap, true, 1000)).toBe('/alarm');
  });

  it('skips the mission for test naps regardless of the mission setting', () => {
    const nap: ActiveNap = { ...BASE_NAP, isTest: true };
    expect(resolveNapRoute(nap, true, 1000)).toBe('/alarm');
  });
});
