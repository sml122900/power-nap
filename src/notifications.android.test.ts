// 회귀 테스트 — "알림 권한 거부 시 Android 네이티브 알람(STREAM_ALARM)조차 예약 안 되던"
// 버그(scheduleAlarmNotificationAsync의 조기 return이 Platform 분기보다 앞에 있어서
// 발생)를 다시 잡는다. expo-alarm-module의 scheduleAlarm은 소스 확인 결과 알림 권한과
// 무관하게 항상 호출돼야 한다 — CLAUDE.md 지뢰 목록 참고.
//
// Platform 모듈 자체를 jest.mock()하면 jest-expo 프리셋 자체의 부트스트랩(expo-modules-core가
// 설정 시점에 Platform.OS를 읽음)이 깨진다 — 대신 실제 Platform 객체의 OS 값을 테스트
// 안에서 직접 바꿔치기한다(react-native의 Platform.OS는 일반 쓰기 가능한 프로퍼티).
import { Platform } from 'react-native';

const mockScheduleAlarm = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-alarm-module', () => ({
  scheduleAlarm: (...args: unknown[]) => mockScheduleAlarm(...args),
  removeAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { scheduleAlarmNotificationAsync } from './notifications';

const originalOS = Platform.OS;

beforeEach(() => {
  Platform.OS = 'android';
  mockScheduleAlarm.mockClear();
  mockGetPermissionsAsync.mockReset();
  mockRequestPermissionsAsync.mockReset();
});

afterAll(() => {
  Platform.OS = originalOS;
});

describe('scheduleAlarmNotificationAsync — Android', () => {
  it('알림 권한이 거부돼도 네이티브 알람(scheduleAlarm)은 예약한다', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await scheduleAlarmNotificationAsync(Date.now() + 60_000);

    expect(mockScheduleAlarm).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ notificationId: 'powernap-alarm', permissionGranted: false });
  });

  it('알림 권한이 승인되면 네이티브 알람 예약 + permissionGranted:true', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });

    const result = await scheduleAlarmNotificationAsync(Date.now() + 60_000);

    expect(mockScheduleAlarm).toHaveBeenCalledTimes(1);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled(); // 이미 승인된 상태라 재요청 안 함
    expect(result).toEqual({ notificationId: 'powernap-alarm', permissionGranted: true });
  });

  it('권한이 이미 거부돼있으면 재요청 후에도 거부면 그대로 진행한다', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    await scheduleAlarmNotificationAsync(Date.now() + 60_000);

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockScheduleAlarm).toHaveBeenCalledTimes(1);
  });
});
