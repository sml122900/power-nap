import { useEffect, useState } from 'react';
import { AccessibilityInfo, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { cancelAlarmNotificationAsync } from '@/notifications';
import { clearActiveNap, getActiveNap, type ActiveNap } from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

export default function SleepScreen() {
  const router = useRouter();
  const { t } = useTranslation('sleep');
  const checkNapRoute = useNapWatchdog('/sleep');
  useKeepAwake('nap-sleep');

  const [nap, setNap] = useState<ActiveNap | null>(null);
  const [, setTick] = useState(0);

  // ActiveNap이 없을 때 '/'로 보내는 판단은 useNapWatchdog의 check()가 전담한다
  // (redirectedRef로 가드됨) — 여기서는 화면 렌더용 데이터만 불러온다. 두 곳에서
  // 각자 router.replace를 호출하면 Item 2에서 없앤 레이스가 되살아난다.
  useEffect(() => {
    getActiveNap().then((loaded) => {
      if (loaded) setNap(loaded);
    });
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

  const breathScale = useSharedValue(1);
  const breathOpacity = useSharedValue(0.5);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      breathScale.value = withRepeat(
        withSequence(
          withTiming(2.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      breathOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    });
    return () => {
      cancelled = true;
    };
  }, [breathScale, breathOpacity]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
    opacity: breathOpacity.value,
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
        <Animated.View style={[styles.breathDot, breathStyle]} />
        <Text style={styles.label}>{t('countdownLabel')}</Text>
        <Text style={[styles.countdown, tabularNums]}>{countdownText}</Text>
        <Text style={[styles.wakeAt, tabularNums]}>{wakeAtText}</Text>

        {!nap.notificationPermissionGranted && (
          // 알림 권한 거부 시 실제로 벌어지는 일이 플랫폼마다 다르다(src/notifications.ts
          // 상단 주석 참고): Android는 네이티브 알람(STREAM_ALARM) 소리·진동이 권한과
          // 무관하게 100% 정상 동작한다(expo-alarm-module 소스로 확인됨) — 불확실한 건
          // 화면 자동 점등(풀스크린 인텐트)뿐이라 Android 문구는 "소리는 울린다"를 단정하고
          // 화면 쪽은 중립적으로 남긴다. 실기기 검증 후 확정 예정(REVIEW_NEEDED.md 아님,
          // CLAUDE.md 지뢰 목록 참고) — 그 전까지 단정적 표현 금지.
          // iOS는 foreground JS 타이머가 주 레이어라 "앱을 켜두면 울려요"가 그대로 사실.
          <>
            <Text style={styles.permissionHint}>
              {t(Platform.OS === 'android' ? 'permissionHintAndroid' : 'permissionHint')}
            </Text>
            {Platform.OS === 'android' && (
              <Pressable
                onPress={() => Linking.openSettings()}
                style={({ pressed }) => [styles.permissionBtn, pressed && styles.permissionBtnPressed]}
              >
                <Text style={styles.permissionBtnText}>{t('permissionButton')}</Text>
              </Pressable>
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
  breathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand,
    marginBottom: 40,
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
