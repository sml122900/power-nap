import { useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { setOnboardingComplete } from '@/store';
import { fontFamily, radius, type ThemeColors } from '@/theme';
import { useThemeColors } from '@/ThemeContext';

const SLIDE_KEYS = ['slide1', 'slide2', 'slide3', 'slide4'] as const;
const LAST_INDEX = SLIDE_KEYS.length - 1;

// 첫 실행 시 app/index.tsx가 shouldShowOnboarding 판정으로 이 화면으로 replace하거나,
// 설정 화면 "온보딩 다시 보기"에서 push로 들어온다 — 어느 경로든 종료 동작은 동일하게
// 홈으로 replace한다(원래 자리로 되돌아가는 걸 시도하지 않음 — 단순한 쪽 선택).
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTranslation('onboarding');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await setOnboardingComplete();
    } catch {
      // 저장 실패해도 다음 실행 때 온보딩이 한 번 더 뜨는 것뿐 — 이 화면에 갇히면 안 된다.
    }
    router.replace('/');
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(next);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        {index < LAST_INDEX ? (
          <Pressable onPress={finish} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipText}>{t('skip')}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.flex}
      >
        {SLIDE_KEYS.map((key) => (
          <View key={key} style={[styles.slide, { width }]}>
            <Text style={styles.slideTitle}>{t(`${key}.title`)}</Text>
            <Text style={styles.slideBody}>{t(`${key}.body`)}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDE_KEYS.map((key, i) => (
            <View key={key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        {index === LAST_INDEX && (
          <Pressable onPress={finish} style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}>
            <Text style={styles.ctaBtnText}>{t('getStarted')}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    flex: {
      flex: 1,
    },
    head: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 24,
      paddingTop: 12,
      height: 44,
    },
    skipBtn: {
      minWidth: 60,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    skipText: {
      fontSize: 15,
      fontFamily: fontFamily.semibold,
      color: colors.inkSoft,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    slideTitle: {
      fontSize: 24,
      fontFamily: fontFamily.heavy,
      letterSpacing: -0.48,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: 16,
    },
    slideBody: {
      fontSize: 16,
      fontFamily: fontFamily.regular,
      lineHeight: 24,
      color: colors.inkSoft,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: 16,
      alignItems: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.line,
    },
    dotActive: {
      backgroundColor: colors.brand,
    },
    ctaBtn: {
      width: '100%',
      paddingVertical: 16,
      borderRadius: radius.md,
      backgroundColor: colors.brand,
      alignItems: 'center',
    },
    ctaBtnPressed: {
      backgroundColor: colors.brandPress,
    },
    ctaBtnText: {
      fontSize: 16,
      fontFamily: fontFamily.bold,
      color: '#FFFFFF',
    },
  });
