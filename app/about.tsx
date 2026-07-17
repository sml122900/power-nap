// "파워냅이란?" 정보 화면 — 홈 화면 링크(지난 낮잠 기록/설정과 나란히)에서 진입.
// 수치는 BACKLOG.md의 문헌 근거 섹션(학습 스텝/카페인 발현시간/AI 분석 조언 근거)을
// 단일 출처로 삼아 썼다 — 이 화면 문구를 고칠 땐 그 섹션과 어긋나지 않는지 함께 확인
// (BACKLOG.md "이 화면의 내용은 문헌 근거 섹션과 동기화 유지" 참고). 장기 건강효과·
// 진단/치료 표현은 넣지 않는다(analysis-v2.ts 프롬프트의 "제외할 것"과 동일 기준).
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { fontFamily, radius, type ThemeColors } from '@/theme';
import { useThemeColors } from '@/ThemeContext';

const SECTION_KEYS = ['section1', 'section2', 'section3', 'section4', 'section5'] as const;

export default function AboutScreen() {
  const router = useRouter();
  const { t } = useTranslation('about');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>{t('common:close')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {SECTION_KEYS.map((key) => (
          <View key={key} style={styles.card}>
            <Text style={styles.heading}>{t(`${key}.heading`)}</Text>
            <Text style={styles.body}>{t(`${key}.body`)}</Text>
          </View>
        ))}

        <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.44,
    color: colors.ink,
  },
  closeText: {
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  scrollContent: {
    marginTop: 24,
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
