// 알람 백업 레이어 — PROJECT.md §4.
// Android: 네이티브 알람(expo-alarm-module, STREAM_ALARM)이 주 레이어다. 앱이 백그라운드/
// 종료/잠금 상태여도 무음모드·미디어볼륨과 무관하게 자체 재생하므로, alarm.tsx의 expo-audio
// 레이어는 Android에서 더 이상 쓰지 않는다(사운드는 여기서 전담, 화면/햅틱/해제만 JS 담당).
// iOS: 네이티브 알람 대응 라이브러리가 이 요구사항(무음스위치 우회 등)을 못 주므로 기존
// 로컬 알림 백업 + alarm.tsx의 foreground expo-audio 주 레이어를 그대로 유지한다.
//
// 권한 요청은 앱 시작 시가 아니라 첫 낮잠 시작 시점(scheduleAlarmNotificationAsync 호출 시)에
// 이루어진다. 거부돼도 낮잠 자체는 진행하고(notificationId: null), 화면에서 그 사실을 안내한다.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { removeAlarm, scheduleAlarm, stopAlarm } from 'expo-alarm-module';

import i18n from './i18n';

// 낮잠은 한 번에 하나만 활성화되므로 고정 UID로 충분하다 — 예약(schedule)/취소(remove)는
// 항상 이 UID 쌍으로 호출한다(CLAUDE.md 유령 알람 방지 규칙).
const ANDROID_ALARM_UID = 'powernap-alarm';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // 포그라운드에서는 자체 알람 화면 + expo-audio 사운드가 이미 담당하므로 배너/사운드를
    // 중복 표시하지 않는다. 앱이 백그라운드/종료 상태일 때는 이 핸들러가 호출되지 않고
    // OS가 기본 알림 UI로 표시한다. (Android는 이제 이 경로를 안 타지만 iOS는 그대로 탄다.)
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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

  if (Platform.OS === 'android') {
    // showDismiss/showSnooze는 켜지 않는다 — 알림 자체의 액션 버튼으로 조용히 알람을
    // 끄면 우리 해제 화면(슬라이드/롱프레스)을 건너뛰게 된다. 알림 "본문"을 탭했을 때만
    // 앱(MainActivity)이 열리고, 그 뒤 useNapWatchdog이 /alarm으로 보낸다 — 소리 자체는
    // 우리가 stopAlarm()을 호출하기 전까지 네이티브 쪽에서 계속 재생된다.
    await scheduleAlarm({
      uid: ANDROID_ALARM_UID,
      day: new Date(alarmAt),
      title: i18n.t('alarm:notificationTitle'),
      description: i18n.t('alarm:notificationBody'),
      active: true,
      repeating: false,
      showDismiss: false,
      showSnooze: false,
    });
    return ANDROID_ALARM_UID;
  }

  return Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('alarm:notificationTitle'),
      body: i18n.t('alarm:notificationBody'),
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(alarmAt),
    },
  });
}

export async function cancelAlarmNotificationAsync(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    if (Platform.OS === 'android') {
      await removeAlarm(notificationId);
    } else {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
  } catch {
    // 이미 발화했거나 취소된 알림이면 무시한다.
  }
}

// 알람 화면에서 슬라이드/롱프레스로 해제할 때 호출한다. Android에서만 의미가 있다
// (iOS는 alarm.tsx의 expo-audio player.pause()가 그 역할을 한다).
export async function stopNativeAlarmSoundAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await stopAlarm();
}
