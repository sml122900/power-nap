import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatTime } from '@/format';
import {
  cancelAlarmNotificationAsync,
  getNotificationPermissionGrantedAsync,
  openNotificationSettingsAsync,
} from '@/notifications';
import { clearActiveNap, getActiveNap, type ActiveNap } from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const SLEEPING_DOG = require('../assets/images/sleeping-dog.png');
// 소스 에셋(assets/images/sleeping-dog@3x.png) 픽셀 비율 720x471 — resizeMode="contain"에
// aspectRatio를 명시해 너비 기준으로 폭만 계산하면 높이가 자동으로 따라오게 한다.
const DOG_ASPECT_RATIO = 720 / 471;

export default function SleepScreen() {
  const router = useRouter();
  const { t } = useTranslation('sleep');
  const checkNapRoute = useNapWatchdog('/sleep');
  useKeepAwake('nap-sleep');

  const [nap, setNap] = useState<ActiveNap | null>(null);
  const [, setTick] = useState(0);
  // ActiveNap.notificationPermissionGranted는 낮잠 시작 시점에 고정된 값이라, 사용자가
  // 안내를 보고 설정에서 권한을 켜고 돌아와도 갱신되지 않는다 — 이 화면에 머무는 동안의
  // 실시간 권한 상태는 별도 상태로 들고 AppState 복귀 시 다시 조회한다.
  const [permissionGranted, setPermissionGranted] = useState(true);

  // ActiveNap이 없을 때 '/'로 보내는 판단은 useNapWatchdog의 check()가 전담한다
  // (redirectedRef로 가드됨) — 여기서는 화면 렌더용 데이터만 불러온다. 두 곳에서
  // 각자 router.replace를 호출하면 Item 2에서 없앤 레이스가 되살아난다.
  useEffect(() => {
    getActiveNap().then((loaded) => {
      if (loaded) {
        setNap(loaded);
        setPermissionGranted(loaded.notificationPermissionGranted);
      }
    });
  }, []);

  // 설정 화면에 다녀온 뒤(AppState가 'active'로 복귀할 때) 권한을 다시 조회해, 그새
  // 허용됐으면 안내를 자동으로 감춘다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        getNotificationPermissionGrantedAsync().then(setPermissionGranted);
      }
    });
    return () => subscription.remove();
  }, []);

  // 카운트다운은 감산이 아니라 매 tick마다 alarmAt(절대시각) - Date.now()를 다시 계산한다.
  // 인터벌은 화면 리렌더 트리거 용도일 뿐, 남은 시간의 근거가 아니다. 알람 전환 판정은
  // useNapWatchdog과 같은 check()를 재사용해 AppState 복귀 판정과 경합하지 않는다
  // (redirectedRef 가드가 두 경로 중 하나만 router.replace를 실행하도록 막는다).
  useEffect(() => {
    if (!nap) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      checkNapRoute();
    }, 250);
    return () => clearInterval(id);
  }, [nap, checkNapRoute]);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // 작은 기기(<700pt 높이)에서는 카운트다운·안내 문구와 세로 공간을 다투므로 비율을
  // 한 단계 낮춘다. 나머지는 화면 폭의 46%.
  const dogWidth = screenWidth * (screenHeight < 700 ? 0.4 : 0.46);

  const breathScale = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      breathScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    });
    return () => {
      cancelled = true;
    };
  }, [breathScale]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
  }));

  const onCancel = async () => {
    if (!nap) return;
    await cancelAlarmNotificationAsync(nap.notificationId);
    await clearActiveNap();
    router.replace('/');
  };

  if (!nap) {
    return <View style={styles.container} />;
  }

  const remainingMs = Math.max(0, nap.alarmAt - Date.now());
  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const countdownText = `${mm}:${String(ss).padStart(2, '0')}`;

  const wakeAtText =
    nap.mode === 'coffee'
      ? t('wakeAtCoffee', { time: formatTime(new Date(nap.alarmAt)) })
      : t('wakeAtDefault', { time: formatTime(new Date(nap.alarmAt)) });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.Image
          source={SLEEPING_DOG}
          resizeMode="contain"
          style={[
            styles.dog,
            { width: dogWidth, height: dogWidth / DOG_ASPECT_RATIO },
            breathStyle,
          ]}
        />
        <Text style={styles.label}>{t('countdownLabel')}</Text>
        <Text style={[styles.countdown, tabularNums]}>{countdownText}</Text>
        <Text style={[styles.wakeAt, tabularNums]}>{wakeAtText}</Text>

        {!permissionGranted && (
          // 알림 권한 거부 시 실제로 벌어지는 일이 플랫폼마다 다르다(src/notifications.ts
          // 상단 주석 참고): Android는 네이티브 알람(STREAM_ALARM) 소리·진동이 권한과
          // 무관하게 100% 정상 동작한다(실기기 검증 완료, PROJECT.md §4 표 참고) — 권한이
          // 실제로 좌우하는 건 화면 자동 점등(풀스크린 인텐트)뿐이라 Android 문구는
          // "소리는 울린다"를 단정하고 화면 쪽만 안내한다.
          // iOS는 foreground JS 타이머가 주 레이어라 "앱을 켜두면 울려요"가 그대로 사실.
          <>
            <Text style={styles.permissionHint}>
              {t(Platform.OS === 'android' ? 'permissionHintAndroid' : 'permissionHint')}
            </Text>
            {Platform.OS === 'android' && (
              <>
                {/* 켜야 할 토글 이름을 미리 알려준다 — 설정 화면에 도착한 뒤 뭘 눌러야
                    할지 헤매지 않게. 화면 위에 토글을 직접 가리키는 오버레이/하이라이트는
                    구현하지 않는다: Android에서 다른 앱 위에 그리려면 SYSTEM_ALERT_WINDOW
                    권한이 필요한데, 알림 권한 하나 받으려고 더 민감한 권한을 새로 요청하는
                    건 본말전도고, 스토어 심사에서도 오버레이 권한은 별도 소명이 필요해
                    불리하다. 텍스트 안내로 충분하다고 판단. */}
                <Text style={styles.permissionGuide}>{t('permissionGuide')}</Text>
                <Pressable
                  onPress={() => openNotificationSettingsAsync()}
                  style={({ pressed }) => [styles.permissionBtn, pressed && styles.permissionBtnPressed]}
                >
                  <Text style={styles.permissionBtnText}>{t('permissionButton')}</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>

      <Pressable onPress={onCancel} style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}>
        <Text style={styles.ghostBtnText}>{t('cancelButton')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.night,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dog: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.nightSoft,
    letterSpacing: 0.28,
  },
  countdown: {
    fontSize: 76,
    fontFamily: fontFamily.heavy,
    letterSpacing: -3.04,
    color: colors.surface,
    marginTop: 10,
    marginBottom: 6,
  },
  wakeAt: {
    fontSize: 16,
    fontFamily: fontFamily.semibold,
    color: colors.nightSoft,
    textAlign: 'center',
  },
  permissionHint: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.amber,
    textAlign: 'center',
  },
  permissionGuide: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: colors.nightSoft,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.amber,
  },
  permissionBtnPressed: {
    backgroundColor: colors.onDarkBorderPress,
  },
  permissionBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.amber,
  },
  ghostBtn: {
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.onDarkBorder,
    alignItems: 'center',
  },
  ghostBtnPressed: {
    backgroundColor: colors.onDarkBorderPress,
  },
  ghostBtnText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.onDarkMuted,
  },
});
