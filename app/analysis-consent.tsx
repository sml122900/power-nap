import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { setAiConsent } from '@/store';
import { colors, fontFamily, radius } from '@/theme';

export default function AnalysisConsentScreen() {
  const router = useRouter();

  const onAccept = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setAiConsent(true);
    router.replace('/analysis');
  };

  const onDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setAiConsent(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>AI 분석 안내</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.paragraph}>
          분석을 위해 낮잠 기록(수면 시각·설문·메모)이 서버로 전송됩니다. 전송된 기록은 대기시간·카페인
          발현시간 조정 제안과 조언을 만드는 데만 쓰입니다.
        </Text>
        <Text style={styles.paragraph}>
          제안은 참고용이며, 실제 설정 반영은 항상 직접 눌러야만 적용됩니다.
        </Text>
        <Text style={styles.privacyPlaceholder}>처리방침 (준비 중)</Text>
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onAccept} style={({ pressed }) => [styles.acceptBtn, pressed && styles.acceptBtnPressed]}>
          <Text style={styles.acceptBtnText}>동의하고 시작</Text>
        </Pressable>
        <Pressable onPress={onDecline} style={styles.declineRow}>
          <Text style={styles.declineText}>다음에</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  privacyPlaceholder: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
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
