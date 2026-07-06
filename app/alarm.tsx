import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { configureAlarmAudioModeAsync } from '@/audio';
import { cancelAlarmNotificationAsync, stopNativeAlarmSoundAsync } from '@/notifications';
import { clearActiveNap, getActiveNap, savePendingFeedback, type ActiveNap } from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const ALARM_SOUND = require('../assets/sounds/alarm.wav');
const HAPTICS_INTERVAL_MS = 1200;
const SLIDE_THRESHOLD = 0.8;
const THUMB_SIZE = 56;
const TRACK_PADDING = 4;
const LONG_PRESS_MS = 3000;

// alarm.tsx가 중복 마운트되는 드문 경우(예: 두 곳에서 거의 동시에 /alarm으로 replace)에도
// 햅틱 반복(양쪽 플랫폼 공통)과 expo-audio 재생(iOS 전용, 아래 참고)이 한 인스턴스에서만
// 시작되도록 하는 모듈 레벨 가드. React state/ref는 인스턴스별로 분리되어 이 목적에 쓸 수 없다.
// Android는 소리를 네이티브 알람(expo-alarm-module)이 전담하므로 이 가드가 막는 대상은
// 사실상 햅틱 인터벌뿐이지만, 로직을 플랫폼별로 쪼개지 않기 위해 그대로 공유한다.
let alarmPlaybackActive = false;

export default function AlarmScreen() {
  const router = useRouter();
  useNapWatchdog('/alarm');

  const player = useAudioPlayer(ALARM_SOUND);
  const [nap, setNap] = useState<ActiveNap | null>(null);
  const dismissedRef = useRef(false);
  // useAudioPlayer(코드상 이 함수보다 먼저 호출됨)의 내부 정리(release)는 React가
  // 언마운트 시 이펙트 클린업을 "등록 순서대로"(역순 아님) 실행하기 때문에 우리
  // useEffect의 클린업보다 먼저 실행된다. 즉 우리 클린업이 도는 시점엔 player가 이미
  // 해제돼 있다 — 그래서 클린업에서는 player를 절대 건드리지 않는다(아래 참고).
  // mountedRef는 handleDismiss가 언마운트 이후(예: 지연된 콜백)에 실행돼 이미 해제된
  // player.pause()에 닿는 경로 자체를 없애기 위한 가드다.
  const mountedRef = useRef(true);

  useEffect(() => {
    let hapticsInterval: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    let ownsPlayback = false;

    (async () => {
      const loaded = await getActiveNap();
      if (stopped) return;
      setNap(loaded);

      if (alarmPlaybackActive) return; // 이미 다른 인스턴스가 재생을 시작한 상태
      alarmPlaybackActive = true;
      ownsPlayback = true;

      // Android는 네이티브 알람이 이미 STREAM_ALARM으로 재생 중이다 — 여기서 또
      // expo-audio를 켜면 소리가 겹친다. iOS만 이 레이어가 주 알람 사운드를 담당한다.
      if (Platform.OS === 'ios') {
        await configureAlarmAudioModeAsync();
        if (stopped) return;

        player.loop = true;
        player.volume = 1.0;
        player.play();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      hapticsInterval = setInterval(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, HAPTICS_INTERVAL_MS);
    })();

    return () => {
      stopped = true;
      mountedRef.current = false;
      if (hapticsInterval) clearInterval(hapticsInterval);
      // player.pause()를 여기서 부르지 않는다: useAudioPlayer가 언마운트 시 자동으로
      // release하므로 재생 정지는 이미 보장된다. 여기서 pause를 부르면 위 주석의
      // 클린업 순서 문제로 "Cannot use shared object that was already released"가 던져진다.
      if (ownsPlayback) alarmPlaybackActive = false;
    };
  }, [player]);

  const handleDismiss = async () => {
    if (dismissedRef.current || !mountedRef.current) return;
    dismissedRef.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Android는 네이티브 알람(stopAlarm)이 소리를 전담하므로 그쪽을 멈추고, iOS는 이
    // 화면의 expo-audio 재생을 직접 멈춘다 — stopNativeAlarmSoundAsync는 Android에서만
    // 동작하는 no-op 안전 래퍼다(src/notifications.ts 참고).
    if (Platform.OS === 'ios') {
      player.pause();
    }
    await stopNativeAlarmSoundAsync();

    const active = nap ?? (await getActiveNap());
    await cancelAlarmNotificationAsync(active?.notificationId ?? null);
    if (active) {
      const offsetMinutes = Math.round((active.alarmAt - active.startedAt) / 60_000);
      await savePendingFeedback({ mode: active.mode, coffee: active.coffee, offsetMinutes });
    }
    // ActiveNap을 먼저 지워야 후기 화면에서 강제 종료돼도 재실행 시 알람으로
    // 되돌아가지 않는다(§6.4) — mode는 위에서 이미 pendingFeedback에 옮겨 담았다.
    await clearActiveNap();
    router.replace('/feedback');
  };

  // ── 슬라이드 해제 트랙 ──
  const trackWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    trackWidth.value = event.nativeEvent.layout.width;
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const max = Math.max(trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2, 0);
      translateX.value = Math.min(Math.max(startX.value + event.translationX, 0), max);
    })
    .onEnd(() => {
      const max = Math.max(trackWidth.value - THUMB_SIZE - TRACK_PADDING * 2, 0);
      if (max > 0 && translateX.value >= max * SLIDE_THRESHOLD) {
        translateX.value = withTiming(max, { duration: 150 }, (finished) => {
          if (finished) runOnJS(handleDismiss)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  // RN 기본 Pressable의 onLongPress는 GestureHandlerRootView가 터치 응답 시스템을
  // 가로채는 상태에서 타이밍 레이스로 씹힐 수 있다(릴리즈 빌드에서만 재현 — JS 스레드가
  // 느린 개발 빌드에선 우연히 안 걸림). 슬라이드 트랙(Gesture.Pan)과 같은 RNGH 계열
  // 제스처로 통일해 같은 응답 시스템 안에서만 동작하도록 한다.
  // maxDistance 기본값(약 10pt)은 3초 내내 정지 유지를 요구하기엔 너무 빡빡해서 손 미세
  // 떨림만으로 제스처가 취소돼 실기기에서 전혀 인식되지 않았다 — 넉넉하게 완화한다.
  const longPress = Gesture.LongPress()
    .minDuration(LONG_PRESS_MS)
    .maxDistance(40)
    .onStart(() => {
      runOnJS(handleDismiss)();
    });

  // 별도 텍스트 링크가 아니라 슬라이드 손잡이 자체에 롱프레스를 얹는다 — 사용자가 이미
  // 만지는 지점과 다른 곳에 "3초간 눌러 끄기" 텍스트를 따로 두니 어디를 눌러야 하는지
  // 못 찾는다는 피드백(실기기 검증)을 반영. Race: 가만히 3초 누르면 롱프레스가 이기고,
  // 손가락이 움직이기 시작하면 Pan이 활성화되어 롱프레스는 취소된다.
  const thumbGesture = Gesture.Race(pan, longPress);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const trackFillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE,
  }));

  const ring1 = useRingPulse(0);
  const ring2 = useRingPulse(500);
  const ring3 = useRingPulse(1000);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.ringWrap}>
          <Animated.View style={[styles.ring, ring1]} />
          <Animated.View style={[styles.ring, ring2]} />
          <Animated.View style={[styles.ring, ring3]} />
          <View style={styles.ringCore} />
        </View>

        <Text style={styles.title}>일어날 시간이에요</Text>
        <Text style={styles.subtitle}>
          5분 더 자면 수면 관성 때문에 더 멍해져요.{'\n'}지금 바로 일어나는 게 제일 개운합니다.
        </Text>

        {nap?.coffee && (
          <View style={styles.coffeeBadge}>
            <Text style={styles.coffeeBadgeText}>지금부터 카페인 효과가 시작돼요</Text>
          </View>
        )}
      </View>

      <View
        style={styles.slideTrack}
        onLayout={onTrackLayout}
        accessible
        accessibilityRole="button"
        accessibilityLabel="밀어서 알람 끄기"
        accessibilityActions={[{ name: 'activate', label: '알람 끄기' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') handleDismiss();
        }}
      >
        <Animated.View style={[styles.slideTrackFill, trackFillStyle]} />
        <Text style={styles.slideLabel} pointerEvents="none">
          밀어서 끄기
        </Text>
        <GestureDetector gesture={thumbGesture}>
          <Animated.View style={[styles.slideThumb, thumbStyle]} />
        </GestureDetector>
      </View>

      <Text style={styles.longPressHint} pointerEvents="none">
        슬라이드가 어렵다면 손잡이를 3초간 눌러도 꺼져요
      </Text>
    </SafeAreaView>
  );
}

// prototype.html의 @keyframes ring(0%: scale(.4) opacity 1 → 100%: scale(1.15) opacity 0,
// 1.6s, 3개 링을 .5s 간격으로 스태거)을 이식. CSS는 각 반복이 0%에서 다시 시작하므로
// withSequence로 타이밍 종료 직후 시작값으로 순간 복귀시켜 같은 "펄스"를 만든다.
function useRingPulse(delayMs: number) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(1);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      scale.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1.15, { duration: 1600, easing: Easing.out(Easing.ease) }),
            withTiming(0.4, { duration: 0 })
          ),
          -1
        )
      );
      opacity.value = withDelay(
        delayMs,
        withRepeat(withSequence(withTiming(0, { duration: 1600 }), withTiming(1, { duration: 0 })), -1)
      );
    });
    return () => {
      cancelled = true;
    };
  }, [delayMs, scale, opacity]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  ringCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 30,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.9,
    color: colors.surface,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23.25,
    fontFamily: fontFamily.regular,
    color: colors.onDarkMuted,
    textAlign: 'center',
  },
  coffeeBadge: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.onDarkOverlaySubtle,
  },
  coffeeBadgeText: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.amber,
  },
  slideTrack: {
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  slideTrackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brandTint,
  },
  slideLabel: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.brand,
  },
  slideThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.brand,
  },
  // 이제 탭 대상이 아니라 순수 안내문(제스처는 슬라이드 손잡이에 있음) — 밑줄 제거.
  longPressHint: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.onDarkHint,
  },
});
