import { useEffect, useState } from 'react';
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
import { cancelAlarmNotificationAsync, scheduleAlarmNotificationAsync } from '@/notifications';
import {
  bucketFor,
  clearActiveNap,
  getActiveNap,
  getSettings,
  saveActiveNap,
  type ActiveNap,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const DEFAULT_OFFSETS: Settings['offsets'] = { fast: 20, slow: 30, fastCoffee: 20, slowCoffee: 30 };

export default function SleepScreen() {
  const router = useRouter();
  const checkNapRoute = useNapWatchdog('/sleep');
  useKeepAwake('nap-sleep');

  const [nap, setNap] = useState<ActiveNap | null>(null);
  const [offsets, setOffsets] = useState<Settings['offsets']>(DEFAULT_OFFSETS);
  const [, setTick] = useState(0);

  // ActiveNap이 없을 때 '/'로 보내는 판단은 useNapWatchdog의 check()가 전담한다
  // (redirectedRef로 가드됨) — 여기서는 화면 렌더용 데이터만 불러온다. 두 곳에서
  // 각자 router.replace를 호출하면 Item 2에서 없앤 레이스가 되살아난다.
  useEffect(() => {
    getActiveNap().then((loaded) => {
      if (loaded) setNap(loaded);
    });
  }, []);

  // 커피 토글 전에도 켰을 때의 알람 시각을 미리 보여주기 위한 오프셋 값.
  useEffect(() => {
    getSettings().then((settings) => setOffsets(settings.offsets));
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

  // 커피 토글은 알람 시각을 즉시 재계산한다: startedAt + 해당 버킷(coffee 여부) 오프셋.
  // 재계산 값이 지금부터 30초도 안 남았으면(토글이 늦게 눌리거나 오프셋이 이미 지난 경우)
  // now+30초로 가드한다. 예약/취소는 반드시 쌍으로 — 기존 백업 알림을 먼저 취소하고
  // 새 시각으로 재예약한 뒤 notificationId를 갱신한다(CLAUDE.md 예약/취소 쌍 원칙).
  const MIN_LEAD_MS = 30_000;

  const onToggleCoffee = async () => {
    if (!nap) return;
    const coffee = !nap.coffee;
    const settings = await getSettings();
    const bucket = bucketFor(nap.mode, coffee);
    const recalculated = nap.startedAt + settings.offsets[bucket] * 60_000;
    const alarmAt = Math.max(recalculated, Date.now() + MIN_LEAD_MS);

    await cancelAlarmNotificationAsync(nap.notificationId);
    const notificationId = await scheduleAlarmNotificationAsync(alarmAt);

    const updated: ActiveNap = { ...nap, coffee, alarmAt, notificationId };
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

  // 커피 켜기 전에도 "켜면 몇 시에, 몇 분짜리 낮잠이 되는지" 미리 보여준다(§DESIGN_HANDOFF:
  // 요소 추가 없이 텍스트로 해결). 실제 예약 계산(onToggleCoffee)과 동일한 MIN_LEAD_MS 가드.
  const coffeePreviewOffset = offsets[bucketFor(nap.mode, true)];
  const coffeePreviewAlarmAt = Math.max(nap.startedAt + coffeePreviewOffset * 60_000, Date.now() + MIN_LEAD_MS);

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
            <Text style={[styles.coffeeTitle, nap.coffee && styles.coffeeTitleOn]}>방금 커피 마셨어요</Text>
            <Text style={[styles.coffeeSubtitle, nap.coffee && styles.coffeeSubtitleOn]}>
              {nap.coffee
                ? '깰 때쯤 효과가 시작돼요'
                : `켜면 ${formatKoreanTime(new Date(coffeePreviewAlarmAt))} 알람 (${coffeePreviewOffset}분)`}
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
  // amberTint 배경(밝은 크림색)으로 바뀌면 night 배경용 흰 텍스트는 대비가 사라진다.
  // ink/inkSoft는 amberTint 위에서 각각 15.3:1 / 5.4:1로 WCAG AA(4.5:1) 이상을 만족한다.
  // (참고: 기존 amberTextOn(#A06818)은 amberTint 위에서 약 4.25:1로 기준 미달이라 폐기)
  coffeeTitleOn: {
    color: colors.ink,
  },
  coffeeSubtitle: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.nightSoft,
  },
  coffeeSubtitleOn: {
    color: colors.inkSoft,
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
