import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { formatKoreanTime } from '@/format';
import { cancelAlarmNotificationAsync } from '@/notifications';
import { clearActiveNap, getActiveNap, saveActiveNap, type ActiveNap } from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

export default function SleepScreen() {
  const router = useRouter();
  useNapWatchdog('/sleep');
  useKeepAwake('nap-sleep');

  const [nap, setNap] = useState<ActiveNap | null>(null);
  const [, setTick] = useState(0);
  const alarmHandledRef = useRef(false);

  useEffect(() => {
    getActiveNap().then((loaded) => {
      if (!loaded) {
        router.replace('/');
        return;
      }
      setNap(loaded);
    });
  }, [router]);

  // 카운트다운은 감산이 아니라 매 tick마다 alarmAt(절대시각) - Date.now()를 다시 계산한다.
  // 인터벌은 화면 리렌더 트리거 용도일 뿐, 남은 시간의 근거가 아니다.
  useEffect(() => {
    if (!nap) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (!alarmHandledRef.current && nap.alarmAt <= Date.now()) {
        alarmHandledRef.current = true;
        router.replace('/alarm');
      }
    }, 250);
    return () => clearInterval(id);
  }, [nap, router]);

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

  const onToggleCoffee = async () => {
    if (!nap) return;
    const updated: ActiveNap = { ...nap, coffee: !nap.coffee };
    setNap(updated);
    await saveActiveNap(updated);
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.View style={[styles.breathDot, breathStyle]} />
        <Text style={styles.label}>알람까지</Text>
        <Text style={[styles.countdown, tabularNums]}>{countdownText}</Text>
        <Text style={[styles.wakeAt, tabularNums]}>{formatKoreanTime(new Date(nap.alarmAt))}에 깨워드릴게요</Text>

        {nap.notificationId === null && (
          <Text style={styles.permissionHint}>앱을 켠 채로 두면 알람이 울려요</Text>
        )}

        <Pressable
          onPress={onToggleCoffee}
          style={[styles.coffeeRow, nap.coffee && styles.coffeeRowOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: nap.coffee }}
        >
          <View style={styles.coffeeText}>
            <Text style={styles.coffeeTitle}>방금 커피 마셨어요</Text>
            <Text style={[styles.coffeeSubtitle, nap.coffee && styles.coffeeSubtitleOn]}>
              {nap.coffee ? '깰 때쯤 효과가 시작돼요' : '깨어날 때 카페인 효과가 겹치도록 기록해둘게요'}
            </Text>
          </View>
          <View style={[styles.toggleTrack, nap.coffee && styles.toggleTrackOn]}>
            <View style={[styles.toggleThumb, nap.coffee && styles.toggleThumbOn]} />
          </View>
        </Pressable>
      </View>

      <Pressable onPress={onCancel} style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}>
        <Text style={styles.ghostBtnText}>그만 자고 일어나기</Text>
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
  },
  permissionHint: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.amber,
    textAlign: 'center',
  },
  coffeeRow: {
    marginTop: 32,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.onDarkBorder,
  },
  coffeeRowOn: {
    backgroundColor: colors.amberTint,
    borderColor: colors.amberBorder,
  },
  coffeeText: {
    gap: 2,
    flexShrink: 1,
  },
  coffeeTitle: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.surface,
  },
  coffeeSubtitle: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.nightSoft,
  },
  coffeeSubtitleOn: {
    color: colors.amberTextOn,
  },
  toggleTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.toggleTrackOff,
    justifyContent: 'center',
    padding: 3,
  },
  toggleTrackOn: {
    backgroundColor: colors.amber,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  toggleThumbOn: {
    transform: [{ translateX: 20 }],
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
