// 기상 루틴 3화면(wake-stretch/wake-light/wake-water)이 공유하는 슬라이드 컴포넌트 —
// app/alarm.tsx의 슬라이드 해제 트랙과 같은 시각/제스처 언어(트랙·손잡이·채움 애니메이션,
// SLIDE_THRESHOLD 0.8)를 쓴다. alarm.tsx는 이미 실기기 검증된 안전 필수 코드라 그대로
// 두고, 롱프레스 대체 수단(§6.3, 알람 해제 전용 안정성 보강)은 여기 옮기지 않았다 — 이
// 화면들은 알람을 끄는 화면이 아니라 그 이후 단계라 슬라이드 하나로 충분하다는 판단.
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, fontFamily, radius } from './theme';

const SLIDE_THRESHOLD = 0.8;
const THUMB_SIZE = 56;
const TRACK_PADDING = 4;

interface SlideToConfirmProps {
  label: string;
  a11yLabel: string;
  a11yActionLabel: string;
  onConfirm: () => void;
}

export function SlideToConfirm({ label, a11yLabel, a11yActionLabel, onConfirm }: SlideToConfirmProps) {
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
          if (finished) runOnJS(onConfirm)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const trackFillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.track}
        onLayout={onTrackLayout}
        accessible
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityActions={[{ name: 'activate', label: a11yActionLabel }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onConfirm();
        }}
      >
        <Animated.View style={[styles.trackFill, trackFillStyle]} />
        <Text style={styles.label} pointerEvents="none">
          {label}
        </Text>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: TRACK_PADDING,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.brandTint,
  },
  label: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.brand,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.brand,
  },
});
