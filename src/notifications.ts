// 알람 백업 레이어 — PROJECT.md §4 레이어 2(로컬 알림).
// 권한 요청은 앱 시작 시가 아니라 첫 낮잠 시작 시점(scheduleAlarmNotificationAsync 호출 시)에
// 이루어진다. 거부돼도 낮잠 자체는 진행하고(notificationId: null), 화면에서 그 사실을 안내한다.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const ANDROID_CHANNEL_ID = 'alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // 포그라운드에서는 자체 알람 화면 + expo-audio 사운드가 이미 담당하므로 배너/사운드를
    // 중복 표시하지 않는다. 앱이 백그라운드/종료 상태일 때는 이 핸들러가 호출되지 않고
    // OS가 기본 알림 UI로 표시한다.
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '낮잠 알람',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function requestNotificationPermissionAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// alarmAt(절대시각)에 발화하도록 예약한다. 권한이 없으면 요청하고, 그래도 거부되면
// null을 반환한다 — 호출부는 이를 ActiveNap.notificationId에 그대로 저장한다.
export async function scheduleAlarmNotificationAsync(alarmAt: number): Promise<string | null> {
  const granted = await requestNotificationPermissionAsync();
  if (!granted) return null;

  await ensureAndroidChannelAsync();

  return Notifications.scheduleNotificationAsync({
    content: {
      title: '일어날 시간이에요',
      body: '파워냅 알람이 울리고 있어요.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(alarmAt),
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });
}

export async function cancelAlarmNotificationAsync(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // 이미 발화했거나 취소된 알림이면 무시한다.
  }
}
