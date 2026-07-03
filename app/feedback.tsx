import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  applyFeedback,
  clearPendingFeedback,
  getPendingFeedback,
  getSettings,
  type NapFeedback,
  type NapMode,
} from '@/store';
import { colors, fontFamily, radius } from '@/theme';

const FEEDBACK_OPTIONS: { feedback: NapFeedback; title: string; detail: string }[] = [
  { feedback: 'tooDeep', title: '너무 깊게 잤어요', detail: '머리가 무거워요 — 다음엔 5분 줄일게요' },
  { feedback: 'justRight', title: '딱 좋았어요', detail: '지금 시간 그대로 유지할게요' },
  { feedback: 'notEnough', title: '아직 부족해요', detail: '더 잘 수 있었어요 — 다음엔 5분 늘릴게요' },
];

function modeName(mode: NapMode): string {
  return mode === 'fast' ? '바로 잠듦' : '뒤척임';
}

function buildToastMessage(mode: NapMode, feedback: NapFeedback, before: number, after: number): string {
  const name = modeName(mode);
  if (feedback === 'justRight') {
    return `좋아요. ${name} 모드는 ${after}분 그대로 유지할게요.`;
  }
  if (after === before) {
    const bound = feedback === 'tooDeep' ? '최소' : '최대';
    return `${bound} 시간이라 더 조정하지 않았어요.`;
  }
  return `다음 ${name} 낮잠은 ${after}분으로 맞춰둘게요.`;
}

export default function FeedbackScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<NapMode | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    getPendingFeedback().then((pending) => {
      if (!pending) {
        // 대기 중인 후기가 없다(직접 진입 등 예외 상황) — 안전하게 홈으로.
        router.replace('/');
        return;
      }
      setMode(pending.mode);
    });
  }, [router]);

  const onSelect = async (feedback: NapFeedback) => {
    if (!mode || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const before = (await getSettings()).offsets[mode];
    const updated = await applyFeedback(mode, feedback);
    const after = updated.offsets[mode];
    await clearPendingFeedback();

    const toast = buildToastMessage(mode, feedback, before, after);
    router.replace({ pathname: '/', params: { toast } });
  };

  if (!mode) {
    return <View style={styles.container} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>낮잠 어땠어요?</Text>
        <Text style={styles.subtitle}>다음 낮잠 시간에 바로 반영돼요.</Text>
      </View>

      <View style={styles.buttons}>
        {FEEDBACK_OPTIONS.map((option) => (
          <Pressable
            key={option.feedback}
            onPress={() => onSelect(option.feedback)}
            style={({ pressed }) => [styles.optionBtn, pressed && styles.optionBtnPressed]}
          >
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipText}>
          <Text style={styles.tipTextBold}>개운하게 깨는 법</Text> — 기지개 켜기 → 밝은 빛 쬐기 → 물 한 잔. 3가지면
          수면 관성이 빨리 풀려요.
        </Text>
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
    marginTop: 56,
  },
  title: {
    fontSize: 26,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.78,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22.5,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  buttons: {
    marginTop: 36,
    gap: 12,
  },
  optionBtn: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 22,
    backgroundColor: colors.surface,
    gap: 5,
  },
  optionBtnPressed: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
    transform: [{ scale: 0.985 }],
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.36,
    color: colors.ink,
  },
  optionDetail: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  tipCard: {
    marginTop: 'auto',
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  tipText: {
    fontSize: 13.5,
    lineHeight: 21.6,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  tipTextBold: {
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
});
