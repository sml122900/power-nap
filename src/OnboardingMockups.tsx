// 온보딩 4장(app/onboarding.tsx)에 넣는 정적 화면 목업 — 실제 화면 컴포넌트를 이식하지 않고
// 형태만 본뜬다(상태/훅/네비게이션 없음). 슬라이드별 하이라이트는 전부 같은 outer-glow-ring
// primitive(useGlowOpacity/useRelayGlow)를 공유하고 orchestration만 다르게 한다 — 설계 근거는
// 도그푸딩 전 사용자 확인을 거친 온보딩 목업 설계안 참고.
import { ReactNode, useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
// 개별 아이콘을 서브패스로 import — 배럴(lucide-react-native)에서 이름으로 가져오면
// 전체 아이콘 세트(1000개+)가 Metro 번들에 딸려온다(expo export로 실측: 모듈 수가
// 급증하고 번들이 커짐). lucide-react-native/icons/*는 패키지가 공식 제공하는 개별
// 서브패스라 필요한 아이콘 4개만 번들에 포함된다.
import Droplet from 'lucide-react-native/icons/droplet';
import MessageSquareQuote from 'lucide-react-native/icons/message-square-quote';
import PersonStanding from 'lucide-react-native/icons/person-standing';
import Sun from 'lucide-react-native/icons/sun';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors as lightColors, fontFamily, radius, type ThemeColors } from './theme';

const GLOW_PEAK = 0.55;
const GLOW_REST = 0.12;

// 한 요소를 계속 pulse — 슬라이드3(무료 배지)·슬라이드4(위젯) 하이라이트.
function useGlowOpacity() {
  const value = useSharedValue(GLOW_REST);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      value.value = withRepeat(
        withSequence(
          withTiming(GLOW_PEAK, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(GLOW_REST, { duration: 900, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    });
    return () => {
      cancelled = true;
    };
  }, [value]);
  return useAnimatedStyle(() => ({ opacity: value.value }));
}

// 3개 요소를 0.6초 간격으로 이어달리듯 pulse — 슬라이드1(3버튼)·슬라이드2(3단계) 공유.
function useRelayGlow() {
  const v0 = useSharedValue(GLOW_REST);
  const v1 = useSharedValue(GLOW_REST);
  const v2 = useSharedValue(GLOW_REST);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      [v0, v1, v2].forEach((v, i) => {
        v.value = withDelay(
          i * 600,
          withRepeat(
            withSequence(
              withTiming(GLOW_PEAK, { duration: 300, easing: Easing.inOut(Easing.ease) }),
              withTiming(GLOW_REST, { duration: 1500, easing: Easing.inOut(Easing.ease) })
            ),
            -1
          )
        );
      });
    });
    return () => {
      cancelled = true;
    };
  }, [v0, v1, v2]);
  return [
    useAnimatedStyle(() => ({ opacity: v0.value })),
    useAnimatedStyle(() => ({ opacity: v1.value })),
    useAnimatedStyle(() => ({ opacity: v2.value })),
  ] as const;
}

function GlowRing({
  animatedStyle,
  color,
  cornerRadius,
}: {
  // useAnimatedStyle의 반환 타입은 호출부마다 별도로 좁혀져(AnimatedStyleHandle<Style>)
  // Animated.View의 style 배열 타입과 정확히 맞추려면 매 호출부에서 제네릭을 반복 지정해야
  // 한다 — 이 컴포넌트는 항상 opacity 하나만 pulse하는 내부 전용 장식 요소라 그 비용이
  // 과하다고 판단해 여기서만 any로 느슨하게 받는다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animatedStyle: any;
  color: string;
  cornerRadius: number;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glowRing, { borderColor: color, borderRadius: cornerRadius }, animatedStyle]}
    />
  );
}

function MiniScreen({ backgroundColor, children }: { backgroundColor: string; children: ReactNode }) {
  return <View style={[styles.frame, { backgroundColor }]}>{children}</View>;
}

// ---- 슬라이드 1: 홈 화면 3버튼 (app/index.tsx 색·비율 참조) ----
export function Slide1Mockup({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const [g0, g1, g2] = useRelayGlow();
  return (
    <MiniScreen backgroundColor={colors.bg}>
      <View style={styles.s1}>
        <View style={[styles.s1Btn, styles.s1Fast, { backgroundColor: colors.brand }]}>
          <GlowRing animatedStyle={g0} color={colors.surface} cornerRadius={10} />
          <Text style={[styles.s1BtnTitle, { color: colors.surface }]}>{t('common:napMode.fast')}</Text>
        </View>
        <View style={[styles.s1Btn, styles.s1Slow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <GlowRing animatedStyle={g1} color={colors.brand} cornerRadius={10} />
          <Text style={[styles.s1BtnTitle, { color: colors.ink }]}>{t('common:napMode.slow')}</Text>
        </View>
        <View
          style={[styles.s1Btn, styles.s1Coffee, { backgroundColor: colors.amberTint, borderColor: colors.amberBorder }]}
        >
          <GlowRing animatedStyle={g2} color={colors.amber} cornerRadius={10} />
          <Text style={[styles.s1BtnTitleSmall, { color: colors.ink }]}>{t('common:napMode.coffee')}</Text>
        </View>
      </View>
    </MiniScreen>
  );
}

// ---- 슬라이드 2: 기상 루틴 3단계 + 미션(선택) (WakeRoutineScreen 색·SlideToConfirm 트랙 참조) ----
export function Slide2Mockup() {
  const { t } = useTranslation();
  const [g0, g1, g2] = useRelayGlow();
  const iconColor = lightColors.surface;
  return (
    <MiniScreen backgroundColor={lightColors.brand}>
      <View style={styles.s2}>
        <View style={styles.s2Flow}>
          <View style={styles.s2Chip}>
            <GlowRing animatedStyle={g0} color={lightColors.surface} cornerRadius={999} />
            <PersonStanding size={12} color={iconColor} strokeWidth={2} />
            <Text style={styles.s2ChipText}>{t('onboarding:mockup.stretch')}</Text>
          </View>
          <Text style={styles.s2Arrow}>↓</Text>
          <View style={styles.s2Chip}>
            <GlowRing animatedStyle={g1} color={lightColors.surface} cornerRadius={999} />
            <Sun size={12} color={iconColor} strokeWidth={2} />
            <Text style={styles.s2ChipText}>{t('onboarding:mockup.light')}</Text>
          </View>
          <Text style={styles.s2Arrow}>↓</Text>
          <View style={styles.s2Chip}>
            <GlowRing animatedStyle={g2} color={lightColors.surface} cornerRadius={999} />
            <Droplet size={12} color={iconColor} strokeWidth={2} />
            <Text style={styles.s2ChipText}>{t('onboarding:mockup.water')}</Text>
          </View>
        </View>
        <View style={styles.s2MissionChip}>
          <MessageSquareQuote size={10} color={lightColors.onDarkHint} strokeWidth={2} />
          <Text style={styles.s2MissionText}>{t('onboarding:mockup.mission')}</Text>
        </View>
        <View style={styles.s2Track} />
      </View>
    </MiniScreen>
  );
}

// ---- 슬라이드 3: AI 리포트 (analysis.tsx 배지/카드 스타일 참조) ----
const SKELETON_WIDTHS = ['92%', '76%', '84%', '58%'] as const;

export function Slide3Mockup({ colors }: { colors: ThemeColors }) {
  const { t } = useTranslation();
  const glow = useGlowOpacity();
  return (
    <MiniScreen backgroundColor={colors.surface}>
      <View style={styles.s3}>
        <View style={[styles.s3Badge, { backgroundColor: colors.brandTint }]}>
          <GlowRing animatedStyle={glow} color={colors.brand} cornerRadius={999} />
          <Text style={[styles.s3BadgeText, { color: colors.brand }]}>{t('onboarding:mockup.freeBadge')}</Text>
        </View>
        {SKELETON_WIDTHS.map((width) => (
          <View key={width} style={[styles.s3Skel, { width, backgroundColor: colors.line }]} />
        ))}
        <View style={[styles.s3Card, { borderColor: colors.line }]}>
          <View style={[styles.s3Skel, { width: '78%', backgroundColor: colors.line }]} />
          <View style={[styles.s3Skel, { width: '48%', backgroundColor: colors.line }]} />
          <Text style={[styles.s3Pill, { color: colors.brand, borderColor: colors.brandTint }]}>
            {t('analysisReport:suggestion.applied')}
          </Text>
        </View>
      </View>
    </MiniScreen>
  );
}

// ---- 슬라이드 4: 홈 화면 위젯 (withHomeScreenWidgets.js의 M 위젯 비율·색 참조) ----
const GRID_CELL_COUNT = 11;
const WIDGET_SLOT = 5;

export function Slide4Mockup() {
  const { t } = useTranslation();
  const glow = useGlowOpacity();
  const cells = Array.from({ length: GRID_CELL_COUNT });
  return (
    <MiniScreen backgroundColor={lightColors.night}>
      <View style={styles.s4}>
        {cells.map((_, i) =>
          i === WIDGET_SLOT ? (
            <View key="widget" style={styles.s4Widget}>
              <GlowRing animatedStyle={glow} color={lightColors.brand} cornerRadius={8} />
              <View style={[styles.s4WidgetHalf, { backgroundColor: lightColors.brand }]}>
                <Text style={styles.s4WidgetTextLight}>{t('common:napMode.fast')}</Text>
              </View>
              <View style={[styles.s4WidgetHalf, { backgroundColor: lightColors.surface }]}>
                <Text style={styles.s4WidgetTextDark}>{t('common:napMode.slow')}</Text>
              </View>
            </View>
          ) : (
            <View key={i} style={styles.s4Icon} />
          )
        )}
      </View>
    </MiniScreen>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 128,
    height: 224,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  glowRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 1.5,
  },

  // 슬라이드 1
  s1: {
    flex: 1,
    padding: 10,
    gap: 6,
  },
  s1Btn: {
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  s1Fast: { flex: 2 },
  s1Slow: { flex: 2, borderWidth: 1.2 },
  s1Coffee: { flex: 1, borderWidth: 1.2 },
  s1BtnTitle: { fontSize: 11, fontFamily: fontFamily.heavy },
  s1BtnTitleSmall: { fontSize: 10, fontFamily: fontFamily.bold },

  // 슬라이드 2
  s2: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 12,
  },
  // 3단계를 가로로 나열하면(원래 시도) 프레임 폭(128) 안에 안 들어가 좌우가
  // 잘린다(실기기 확인) — 세로로 쌓아 폭 제약 자체를 없앤다.
  s2Flow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  s2Chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 7,
    position: 'relative',
  },
  s2ChipText: { fontSize: 8.5, fontFamily: fontFamily.bold, color: '#FFFFFF' },
  s2Arrow: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  s2MissionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  s2MissionText: { fontSize: 8, fontFamily: fontFamily.semibold, color: 'rgba(255,255,255,0.6)' },
  s2Track: {
    width: 70,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // 슬라이드 3
  s3: {
    flex: 1,
    padding: 12,
    gap: 7,
  },
  s3Badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    position: 'relative',
  },
  s3BadgeText: { fontSize: 8.5, fontFamily: fontFamily.bold },
  s3Skel: { height: 6, borderRadius: 3 },
  s3Card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    gap: 5,
    marginTop: 2,
  },
  s3Pill: {
    alignSelf: 'flex-end',
    fontSize: 7,
    fontFamily: fontFamily.bold,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },

  // 슬라이드 4
  s4: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    padding: 12,
    gap: 6,
  },
  s4Icon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  s4Widget: {
    flexDirection: 'row',
    width: 50,
    height: 22,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  s4WidgetHalf: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  s4WidgetTextLight: { fontSize: 6, fontFamily: fontFamily.bold, color: '#FFFFFF' },
  s4WidgetTextDark: { fontSize: 6, fontFamily: fontFamily.bold, color: lightColors.ink },
});
