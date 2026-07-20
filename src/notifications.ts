// 알람 백업 레이어 — PROJECT.md §4.
// Android: 네이티브 알람(expo-alarm-module, STREAM_ALARM)이 주 레이어다. 앱이 백그라운드/
// 종료/잠금 상태여도 무음모드·미디어볼륨과 무관하게 자체 재생하므로, alarm.tsx의 expo-audio
// 레이어는 Android에서 더 이상 쓰지 않는다(사운드는 여기서 전담, 화면/햅틱/해제만 JS 담당).
// iOS: 네이티브 알람 대응 라이브러리가 이 요구사항(무음스위치 우회 등)을 못 주므로 기존
// 로컬 알림 백업 + alarm.tsx의 foreground expo-audio 주 레이어를 그대로 유지한다.
//
// 권한 요청은 앱 시작 시가 아니라 첫 낮잠 시작 시점(scheduleAlarmNotificationAsync 호출 시)에
// 이루어진다. 거부돼도 낮잠 자체는 진행한다.
//
// CLAUDE.md 지뢰 목록 참고 — 알림 권한(POST_NOTIFICATIONS)과 Android 네이티브 알람 예약은
// 완전히 별개다. expo-alarm-module 소스(Helper.scheduleAlarm/Manager.start) 확인 결과
// AlarmManager 예약과 STREAM_ALARM 재생 어디에도 알림 권한 체크가 없다 — 권한이 없어도
// 알람 소리·진동은 100% 정상 동작한다. 권한이 없을 때 실제로 불확실한 건 "화면이 자동으로
// 켜지는지"뿐(풀스크린 인텐트가 알림 배너 억제와 함께 묶여 억제되는지는 실기기 확인 전까지
// 단정하지 않는다 — app/sleep.tsx의 안내 문구가 중립적인 이유).

import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { getAlarmState, removeAlarm, scheduleAlarm, stopAlarm } from 'expo-alarm-module';

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

export interface ScheduleAlarmResult {
  notificationId: string | null;
  // 알림 권한(POST_NOTIFICATIONS) 승인 여부 — Android에서는 알람 자체의 성패와 무관하다
  // (위 상단 주석 참고), 화면 자동 점등 등 권한에 실제로 의존하는 부분만 이 값으로 안내한다.
  permissionGranted: boolean;
}

// alarmAt(절대시각)에 발화하도록 예약한다. 알림 권한은 요청은 하되, Android 네이티브
// 알람 예약은 그 결과와 무관하게 항상 수행한다 — 거부돼도 소리·진동은 정상 동작해야
// 하기 때문(CLAUDE.md 지뢰 목록). iOS는 로컬 알림 자체가 백업 레이어라 권한이 없으면
// 예약할 게 없어 기존 동작(notificationId: null)을 그대로 유지한다.
export async function scheduleAlarmNotificationAsync(alarmAt: number): Promise<ScheduleAlarmResult> {
  const granted = await requestNotificationPermissionAsync();

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
    return { notificationId: ANDROID_ALARM_UID, permissionGranted: granted };
  }

  if (!granted) return { notificationId: null, permissionGranted: false };

  const notificationId = await Notifications.scheduleNotificationAsync({
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
  return { notificationId, permissionGranted: true };
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

// 알림 스와이프(setDeleteIntent, PROJECT.md §4)로 우리 화면을 거치지 않고 네이티브
// 알람만 꺼지는 경로가 있다 — 그 경우 ActiveNap이 JS에 남아 useNapWatchdog이 죽은
// 알람 화면으로 되돌아간다(진동만 남는 버그). expo-alarm-module의 Manager.activeAlarmUid는
// 앱 메인 프로세스에서만 도는 static 필드(AlarmService가 android:process 미지정)라
// getAlarmState()로 "지금 진짜 울리는 중인지"를 물어보면 이 경로를 감지할 수 있다.
// iOS는 이 문제 자체가 없어(3중 레이어 구조가 다름) 항상 true로 기존 동작을 유지한다.
export async function isNativeAlarmActiveAsync(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const activeUid = await getAlarmState();
  return activeUid === ANDROID_ALARM_UID;
}

// 수면 화면 "권한 허용하기" 버튼에서 호출. 지금 시점의 실제 권한 상태를 다시 조회한다
// (ActiveNap.notificationPermissionGranted는 낮잠 시작 시점에 고정된 값이라 설정에서
// 갔다 온 뒤의 변화를 반영 못 함).
export async function getNotificationPermissionGrantedAsync(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

// 앱의 알림 설정 화면으로 딥링크한다. Android는 ACTION_APP_NOTIFICATION_SETTINGS로
// "알림 허용" 토글이 바로 보이는 화면까지 직행하고, iOS는 그런 세부 화면 인텐트가 없어
// 앱 설정 화면(Linking.openSettings())으로 보낸다. Android에서 패키지명을 못 얻거나
// 인텐트 자체가 실패하면(제조사 커스텀 설정 앱 등) 같은 폴백으로 내려간다.
export async function openNotificationSettingsAsync(): Promise<void> {
  if (Platform.OS === 'android') {
    const packageName = Constants.expoConfig?.android?.package;
    if (packageName) {
      try {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
          extra: { 'android.provider.extra.APP_PACKAGE': packageName },
        });
        return;
      } catch {
        // 아래 폴백으로 진행.
      }
    }
  }
  await Linking.openSettings();
}

// 알람 예약(scheduleAlarm) 실패 시 홈 화면의 안내 다이얼로그에서 호출한다. Android 12+의
// "알람 및 리마인더" 특수 권한 화면으로 직행 — REQUEST_SCHEDULE_EXACT_ALARM은 data URI로
// 패키지를 지정해야 한다(extra 방식인 APP_NOTIFICATION_SETTINGS와 다름). 실패하면 일반
// 앱 설정 화면으로 폴백.
export async function openExactAlarmSettingsAsync(): Promise<void> {
  const packageName = Constants.expoConfig?.android?.package;
  if (packageName) {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
        data: `package:${packageName}`,
      });
      return;
    } catch {
      // 아래 폴백으로 진행.
    }
  }
  await Linking.openSettings();
}
