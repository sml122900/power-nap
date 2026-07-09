// iOS는 이번 수정의 영향을 받지 않아야 한다 — 로컬 알림 자체가 백업 레이어라 권한이
// 없으면 예약할 게 없다(foreground expo-audio가 주 레이어, alarm.tsx 참고). 회귀 확인용.
// Platform 모듈 통째로 mock하지 않는 이유는 notifications.android.test.ts 상단 주석 참고.
import { Platform } from 'react-native';

jest.mock('expo-alarm-module', () => ({
  scheduleAlarm: jest.fn(),
  removeAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockScheduleNotificationAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { scheduleAlarmNotificationAsync } from './notifications';

const originalOS = Platform.OS;

beforeEach(() => {
  Platform.OS = 'ios';
  mockScheduleNotificationAsync.mockReset();
  mockGetPermissionsAsync.mockReset();
  mockRequestPermissionsAsync.mockReset();
});

afterAll(() => {
  Platform.OS = originalOS;
});

describe('scheduleAlarmNotificationAsync — iOS (기존 동작 유지)', () => {
  it('알림 권한이 거부되면 로컬 알림을 예약하지 않고 null을 반환한다', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await scheduleAlarmNotificationAsync(Date.now() + 60_000);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ notificationId: null, permissionGranted: false });
  });

  it('알림 권한이 승인되면 로컬 알림을 예약한다', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockScheduleNotificationAsync.mockResolvedValue('ios-notif-id');

    const result = await scheduleAlarmNotificationAsync(Date.now() + 60_000);

    expect(mockScheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ notificationId: 'ios-notif-id', permissionGranted: true });
  });
});
