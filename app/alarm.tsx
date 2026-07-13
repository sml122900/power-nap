import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
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

import { finishNap } from '@/finishNap';
import { getActiveNap, getSettings, markAlarmDismissed, type ActiveNap } from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useAlarmPlayback } from '@/useAlarmPlayback';
import { useNapWatchdog } from '@/useNapWatchdog';

const ALARM_SOUND = require('../assets/sounds/alarm.wav');
const SLIDE_THRESHOLD = 0.8;
const THUMB_SIZE = 56;
const TRACK_PADDING = 4;
const LONG_PRESS_MS = 3000;

export default function AlarmScreen() {
  const router = useRouter();
  const { t } = useTranslation('alarm');
  useNapWatchdog('/alarm');

  const player = useAudioPlayer(ALARM_SOUND);
  useAlarmPlayback(player);
  const [nap, setNap] = useState<ActiveNap | null>(null);
  // 미션 켜짐 여부에 따라 슬라이드/롱프레스 안내 문구가 갈린다(아래 slideLabel 등) —
  // 미션이 켜져 있으면 이 화면의 해제는 알람을 끄는 게 아니라 다음 단계(명언 입력)로
  // 넘어가는 것뿐이라 문구도 그렇게 안내해야 한다.
  const [missionEnabled, setMissionEnabled] = useState(false);
  const dismissedRef = useRef(false);
  // useAudioPlayer(코드상 이 함수보다 먼저 호출됨)의 내부 정리(release)는 React가
  // 언마운트 시 이펙트 클린업을 "등록 순서대로"(역순 아님) 실행하기 때문에 우리
  // useEffect의 클린업보다 먼저 실행된다. 즉 우리 클린업이 도는 시점엔 player가 이미
  // 해제돼 있다 — 그래서 클린업에서는 player를 절대 건드리지 않는다(아래 참고).
  // mountedRef는 handleDismiss가 언마운트 이후(예: 지연된 콜백)에 실행돼 이미 해제된
  // player.pause()에 닿는 경로 자체를 없애기 위한 가드다.
  const mountedRef = useRef(true);

  // 알람 화면은 오터치 방지를 위해 해제를 슬라이드/롱프레스로만 받는다(§6.3) —
  // 하드웨어 뒤로가기로 빠져나가는 경로를 막는다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const [loadedNap, settings] = await Promise.all([getActiveNap(), getSettings()]);
      if (stopped) return;
      setNap(loadedNap);
      setMissionEnabled(settings.missionEnabled);
    })();
    return () => {
      stopped = true;
      mountedRef.current = false;
    };
  }, []);

  const handleDismiss = async () => {
    if (dismissedRef.current || !mountedRef.current) return;
    dismissedRef.current = true;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (missionEnabled) {
      // 슬라이드/롱프레스는 다음 단계(명언 입력)로 넘어가는 게이트일 뿐 — 알람음/진동은
      // 미션까지 계속 울린다(사용자 지시). 실제 정지·알림 취소·기록 저장은 미션 통과
      // 시점(app/mission.tsx → src/finishNap.ts)에서 한다.
      await markAlarmDismissed();
      router.replace('/mission');
      return;
    }

    const active = nap ?? (await getActiveNap());
    const destination = await finishNap(player, active);
    router.replace(destination);
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

  // 손잡이(56pt)만으로는 히트박스가 좁아 도그푸딩에서 롱프레스 실패 리포트가 나왔다 —
  // 이 Race를 트랙 전체+안내 문구를 감싸는 slideZone에 얹어 인식 영역을 넓힌다.
  // Pan은 여전히 같은 제스처라 트랙 아무 곳에서 시작해도 손잡이가 상대 이동량만큼
  // 끌려온다(절대 좌표 스냅 아님, 기존 손잡이 드래그와 동일한 상대 이동 로직).
  // Race: 가만히 3초 누르면 롱프레스가 이기고, maxDistance(40pt)를 넘게 움직이면 Pan이
  // 활성화되어 롱프레스는 취소된다.
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

        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>

        {nap?.mode === 'coffee' && (
          <View style={styles.coffeeBadge}>
            <Text style={styles.coffeeBadgeText}>{t('coffeeBadge')}</Text>
          </View>
        )}
      </View>

      <GestureDetector gesture={thumbGesture}>
        <View style={styles.slideZone}>
          <View
            style={styles.slideTrack}
            onLayout={onTrackLayout}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t(missionEnabled ? 'a11ySlideLabelMission' : 'a11ySlideLabel')}
            accessibilityActions={[
              { name: 'activate', label: t(missionEnabled ? 'a11yDismissActionMission' : 'a11yDismissAction') },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'activate') handleDismiss();
            }}
          >
            <Animated.View style={[styles.slideTrackFill, trackFillStyle]} />
            <Text style={styles.slideLabel} pointerEvents="none">
              {t(missionEnabled ? 'slideLabelMission' : 'slideLabel')}
            </Text>
            <Animated.View style={[styles.slideThumb, thumbStyle]} />
          </View>

          <Text style={styles.longPressHint} pointerEvents="none">
            {t(missionEnabled ? 'longPressHintMission' : 'longPressHint')}
          </Text>
        </View>
      </GestureDetector>
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
  // 롱프레스 인식 영역(트랙+안내 문구)의 공통 래퍼 — GestureDetector가 여기 하나에 얹힌다.
  slideZone: {
    gap: 6,
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
  // 탭 대상이 아니라 순수 안내문(제스처는 slideZone 전체가 받음) — 밑줄 제거.
  // marginTop은 slideZone의 gap이 대신하므로 여기서는 주지 않는다 — 트랙과 붙어
  // 보이도록(한 영역이라는 인상을 주도록).
  longPressHint: {
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.onDarkHint,
  },
});
