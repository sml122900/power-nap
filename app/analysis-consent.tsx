import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { PRIVACY_POLICY_URL } from '@/config';
import { setAiConsent } from '@/store';
import { fontFamily, radius, type ThemeColors } from '@/theme';
import { useThemeColors } from '@/ThemeContext';

export default function AnalysisConsentScreen() {
  const router = useRouter();
  const { t } = useTranslation('analysisConsent');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const onAccept = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setAiConsent(true);
    router.replace('/analysis-period');
  };

  const onDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setAiConsent(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.paragraph}>{t('paragraph1')}</Text>
        <Text style={styles.paragraph}>{t('paragraph2')}</Text>
        <Text style={styles.paragraph}>{t('paragraph3')}</Text>
        <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
          <Text style={styles.privacyLink}>{t('privacyPolicyLink')}</Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onAccept} style={({ pressed }) => [styles.acceptBtn, pressed && styles.acceptBtnPressed]}>
          <Text style={styles.acceptBtnText}>{t('accept')}</Text>
        </Pressable>
        <Pressable onPress={onDecline} style={styles.declineRow}>
          <Text style={styles.declineText}>{t('decline')}</Text>
        </Pressable>
      </View>
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
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.48,
    color: colors.ink,
  },
  body: {
    marginTop: 24,
    gap: 16,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  privacyLink: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: 'auto',
    gap: 8,
  },
  acceptBtn: {
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnPressed: {
    backgroundColor: colors.brandPress,
  },
  acceptBtnText: {
    fontSize: 17,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.34,
    color: colors.surface,
  },
  declineRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  declineText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
});
