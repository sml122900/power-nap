// 알람 백업 레이어 — PROJECT.md §4 레이어 2(로컬 알림).
// 권한 요청은 앱 시작 시가 아니라 첫 낮잠 시작 시점(scheduleAlarmNotificationAsync 호출 시)에
// 이루어진다. 거부돼도 낮잠 자체는 진행하고(notificationId: null), 화면에서 그 사실을 안내한다.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// v2: 채널 ID 버전 올림 — 기존 'alarm' 채널이 설치 초기 설정(무음/저우선순위)으로
// 이미 생성된 기기에서는 이후 importance/sound/vibration을 코드로 바꿔도 반영되지
// 않는다(Android는 채널 생성 후 재설정 불가, 사용자가 시스템 설정에서 직접 바꿔야
// 함). 채널 설정을 바꿀 때마다 ID를 올려 새 채널을 만들어야 한다 — CLAUDE.md 지뢰 목록 참고.
const ANDROID_CHANNEL_ID = 'alarm-v2';

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

// Android 8+(API 26+)은 채널이 없으면 알림이 무음/저우선순위로 표시된다. 낮잠 시작을
// 기다리지 않고 앱 부팅 시(app/_layout.tsx) 한 번 미리 만들어 둔다 — scheduleAlarmNotificationAsync에서도
// 다시 호출하지만(idempotent), 채널 존재 자체를 첫 낮잠 시작 시점에만 의존하지 않기 위함이다.
// 주의: Android는 채널 생성 후 importance/sound를 코드로 재변경할 수 없다(사용자가 시스템
// 설정에서 직접 바꿔야 함) — 그래서 처음부터 MAX/사운드/진동을 명시한다.
export async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: '낮잠 알람',
    importance: Notifications.AndroidImportance.MAX,
    // sound 키 자체를 생략한다: 네이티브 customSoundExists 체크가 문자열 값을 전부
    // "커스텀 사운드 파일명"으로 취급해 res/raw에서 찾으려 하고, 'default'는 그런
    // 파일이 아니라서 매번 "Custom sound 'default' not found" 경고를 띄운다(재생 자체는
    // resolve()의 시스템 기본음 폴백으로 정상 동작하지만 로그가 오염된다). 키를 생략하면
    // Android가 채널 생성 시 시스템 기본 알림음을 그대로 배정해 결과는 동일하다.
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
