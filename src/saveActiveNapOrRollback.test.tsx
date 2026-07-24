// saveActiveNapOrRollback(app/index.tsx) 테스트 — 네이티브 알람 예약 성공 후 ActiveNap
// 저장이 실패했을 때 방금 예약한 알람을 취소하는지(예약/취소 쌍 유지, 유령 알람 방지).
// 같은 파일에 있는 handleWidgetModeEntry 테스트(homeWidgetMode.test.tsx)와 동일한 이유로
// react-native-reanimated/AsyncStorage를 목한다 — app/index.tsx import 시 같이 로드됨.
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

import { saveActiveNapOrRollback } from '../app/index';
import type { ActiveNap } from './store';

function makeNap(notificationId: string | null): ActiveNap {
  return {
    mode: 'fast',
    startedAt: Date.now(),
    alarmAt: Date.now() + 20 * 60_000,
    notificationId,
    notificationPermissionGranted: true,
  };
}

describe('saveActiveNapOrRollback — 저장 실패 시 예약된 알람 취소', () => {
  it('저장 성공: cancelAlarmNotificationAsync를 호출하지 않고 true를 반환', async () => {
    const saveActiveNap = jest.fn(async () => undefined);
    const cancelAlarmNotificationAsync = jest.fn(async () => undefined);
    const nap = makeNap('native-alarm-uid');

    const result = await saveActiveNapOrRollback(nap, { saveActiveNap, cancelAlarmNotificationAsync });

    expect(result).toBe(true);
    expect(saveActiveNap).toHaveBeenCalledWith(nap);
    expect(cancelAlarmNotificationAsync).not.toHaveBeenCalled();
  });

  it('저장 실패: 방금 예약한 알람(notificationId)을 취소하고 false를 반환', async () => {
    const saveActiveNap = jest.fn(async () => {
      throw new Error('AsyncStorage write failed');
    });
    const cancelAlarmNotificationAsync = jest.fn(async () => undefined);
    const nap = makeNap('native-alarm-uid');

    const result = await saveActiveNapOrRollback(nap, { saveActiveNap, cancelAlarmNotificationAsync });

    expect(result).toBe(false);
    expect(cancelAlarmNotificationAsync).toHaveBeenCalledWith('native-alarm-uid');
    expect(cancelAlarmNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('저장 실패 + notificationId가 null(권한 거부로 알림 예약 자체가 없었던 경우)이어도 취소 호출은 그대로 감', async () => {
    const saveActiveNap = jest.fn(async () => {
      throw new Error('AsyncStorage write failed');
    });
    const cancelAlarmNotificationAsync = jest.fn(async () => undefined);
    const nap = makeNap(null);

    const result = await saveActiveNapOrRollback(nap, { saveActiveNap, cancelAlarmNotificationAsync });

    expect(result).toBe(false);
    expect(cancelAlarmNotificationAsync).toHaveBeenCalledWith(null);
  });
});
