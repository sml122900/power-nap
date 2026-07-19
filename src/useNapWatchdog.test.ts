jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { resolveNapRoute, shouldTreatAsOrphaned } from './useNapWatchdog';
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

  it('goes to the alarm screen first once alarmAt has passed, regardless of the mission setting', () => {
    expect(resolveNapRoute(BASE_NAP, false, 1000)).toBe('/alarm'); // alarmAt===now boundary
    expect(resolveNapRoute(BASE_NAP, false, 2000)).toBe('/alarm');
    expect(resolveNapRoute(BASE_NAP, true, 1000)).toBe('/alarm');
  });

  it('routes to the mission screen only after the alarm has been dismissed, when the mission is on', () => {
    const nap: ActiveNap = { ...BASE_NAP, alarmDismissed: true };
    expect(resolveNapRoute(nap, true, 1000)).toBe('/mission');
    expect(resolveNapRoute(nap, false, 1000)).toBe('/alarm');
  });

  it('routes test naps through the same alarm-then-mission sequence', () => {
    const nap: ActiveNap = { ...BASE_NAP, isTest: true };
    expect(resolveNapRoute(nap, true, 1000)).toBe('/alarm');
    const dismissed: ActiveNap = { ...nap, alarmDismissed: true };
    expect(resolveNapRoute(dismissed, true, 1000)).toBe('/mission');
  });

  it('routes preview naps through the exact same sequence as a real nap (isPreview is invisible to routing)', () => {
    const nap: ActiveNap = { ...BASE_NAP, isPreview: true };
    expect(resolveNapRoute(nap, false, 999)).toBe('/sleep');
    expect(resolveNapRoute(nap, true, 1000)).toBe('/alarm');
    const dismissed: ActiveNap = { ...nap, alarmDismissed: true };
    expect(resolveNapRoute(dismissed, true, 1000)).toBe('/mission');
  });
});

describe('shouldTreatAsOrphaned', () => {
  it('is true only when the alarm is due, not yet dismissed, and the native alarm already stopped', () => {
    expect(shouldTreatAsOrphaned(BASE_NAP, false, 1000)).toBe(true);
  });

  it('is false while the native alarm is still ringing — the normal not-yet-dismissed case', () => {
    expect(shouldTreatAsOrphaned(BASE_NAP, true, 1000)).toBe(false);
  });

  it('is false when there is no active nap', () => {
    expect(shouldTreatAsOrphaned(null, false, 1000)).toBe(false);
  });

  it('is false while the alarm has not fired yet (alarmAt in the future)', () => {
    expect(shouldTreatAsOrphaned(BASE_NAP, false, 999)).toBe(false);
  });

  it('is false once the alarm has already been dismissed — this is the post-dismiss race guard: ' +
    'a stray watchdog tick landing right after a normal slide-dismiss (ActiveNap already ' +
    'marked alarmDismissed, or already cleared entirely as the null case above covers) must ' +
    'never re-trigger cleanup, even though the native alarm is by then also stopped', () => {
    const dismissed: ActiveNap = { ...BASE_NAP, alarmDismissed: true };
    expect(shouldTreatAsOrphaned(dismissed, false, 1000)).toBe(false);
  });
});
