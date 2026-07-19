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

  // alarmDismissed:true는 오직 "슬라이드는 넘겼지만 명언은 아직" 상태에서만 존재한다
  // (명언을 실제로 통과하면 finishNap이 ActiveNap 자체를 지워 nap이 곧장 null이 된다) —
  // 그래서 이 값이 true인데 nap이 남아있다는 건 항상 미션 대기 중이라는 뜻이고, 그 상태에서
  // 네이티브가 죽었으면(스와이프) 명언 관문을 건너뛰고 정리해야 한다는 게 이번 설계
  // 결정(docs/decisions/swipe-ends-alarm-only.md) — 예전엔 이 조합을 항상 false로 막는
  // "정상 해제 직후 race guard"가 있었으나, 그 가드가 막던 게 바로 이 케이스였다는 게
  // 드러나 제거했다(정상 해제로 오해할 수 있는 다른 조합은 없다).
  it('is true when the mission is pending (slid past /alarm, quote not yet typed) and native has died — swipe during mission', () => {
    const missionPending: ActiveNap = { ...BASE_NAP, alarmDismissed: true };
    expect(shouldTreatAsOrphaned(missionPending, false, 1000)).toBe(true);
  });

  it('is false when the mission is pending but native is still ringing — the normal in-progress mission case', () => {
    const missionPending: ActiveNap = { ...BASE_NAP, alarmDismissed: true };
    expect(shouldTreatAsOrphaned(missionPending, true, 1000)).toBe(false);
  });
});
