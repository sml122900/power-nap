import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  appendNapRecord,
  applyFeedback,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  clearPendingFeedback,
  getPendingFeedback,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  stepFor,
  type NapFeedback,
  type NapMode,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

function modeName(mode: NapMode): string {
  if (mode === 'fast') return '바로 잠듦';
  if (mode === 'slow') return '뒤척임';
  return '커피냅';
}

// step은 모드별 수렴 상태에 따라 ±3/±2로 갈리므로(store.ts stepFor) 하드코딩하지 않고
// 렌더 시점에 ctx.step으로 채운다 — 그래야 실제 applyFeedback 결과와 라벨이 어긋나지 않는다.
// 커피냅은 caffeineOnset에 반영됨을 문구로 드러낸다.
function buildFeedbackOptions(mode: NapMode, step: number): { feedback: NapFeedback; title: string; detail: string }[] {
  if (mode === 'coffee') {
    return [
      { feedback: 'tooDeep', title: '너무 깊게 잤어요', detail: `다음엔 카페인 발현시간을 ${step}분 줄일게요` },
      { feedback: 'justRight', title: '딱 좋았어요', detail: '지금 발현시간 그대로 유지할게요' },
      { feedback: 'notEnough', title: '아직 부족해요', detail: `다음엔 카페인 발현시간을 ${step}분 늘릴게요` },
    ];
  }
  return [
    { feedback: 'tooDeep', title: '너무 깊게 잤어요', detail: `머리가 무거워요 — 다음엔 ${step}분 줄일게요` },
    { feedback: 'justRight', title: '딱 좋았어요', detail: '지금 시간 그대로 유지할게요' },
    { feedback: 'notEnough', title: '아직 부족해요', detail: `더 잘 수 있었어요 — 다음엔 ${step}분 늘릴게요` },
  ];
}

const MANUAL_STEP = 1;

interface FeedbackContext {
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 실제 사용된 총 시간(분) — NapRecord용
  baseValue: number; // latency[mode] 또는 caffeineOnset — 매뉴얼 스테퍼 시작값
  step: number; // 다음 3버튼 후기가 적용될 스텝 크기(분)
  latency: Settings['latency']; // 학습 상태 캡션용
  caffeineOnset: number; // 학습 상태 캡션용
}

function buildToastMessage(mode: NapMode, feedback: NapFeedback, before: number, after: number): string {
  const name = modeName(mode);
  const label = mode === 'coffee' ? '카페인 발현시간' : '대기시간';
  if (feedback === 'justRight') {
    return `좋아요. ${name} ${label}은 ${after}분 그대로 유지할게요.`;
  }
  if (after === before) {
    const bound = feedback === 'tooDeep' ? '최소' : '최대';
    return `${bound} 시간이라 더 조정하지 않았어요.`;
  }
  return `다음 ${name}은 ${label} ${after}분으로 맞춰둘게요.`;
}

export default function FeedbackScreen() {
  const router = useRouter();
  const [ctx, setCtx] = useState<FeedbackContext | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState<number | null>(null);
  // 입력창에 보여줄 원본 문자열 — 타이핑 중간에 clamp를 걸면("1" 입력 시 바로 하한으로
  // 튐) 사용자가 두 자리 수를 정상적으로 입력할 수 없다. 확정(blur/제출)에서만 clamp한다.
  const [manualText, setManualText] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    getPendingFeedback().then(async (pending) => {
      if (!pending) {
        // 대기 중인 후기가 없다(직접 진입 등 예외 상황) — 안전하게 홈으로.
        router.replace('/');
        return;
      }
      const settings = await getSettings();
      const baseValue = pending.mode === 'coffee' ? settings.caffeineOnset : settings.latency[pending.mode];
      setCtx({
        mode: pending.mode,
        offsetMinutes: pending.offsetMinutes,
        baseValue,
        step: stepFor(settings, pending.mode),
        latency: settings.latency,
        caffeineOnset: settings.caffeineOnset,
      });
    });
  }, [router]);

  const onSelect = async (feedback: NapFeedback) => {
    if (!ctx || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const before = ctx.baseValue;
    const updated = await applyFeedback(ctx.mode, feedback);
    const after = ctx.mode === 'coffee' ? updated.caffeineOnset : updated.latency[ctx.mode];
    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      result: feedback,
    });
    await clearPendingFeedback();

    const toast = buildToastMessage(ctx.mode, feedback, before, after);
    router.replace({ pathname: '/', params: { toast } });
  };

  const manualBounds = () =>
    ctx?.mode === 'coffee' ? { min: CAFFEINE_ONSET_MIN, max: CAFFEINE_ONSET_MAX } : { min: LATENCY_MIN, max: LATENCY_MAX };

  const openManual = () => {
    if (!ctx) return;
    setManualValue(ctx.baseValue);
    setManualText(String(ctx.baseValue));
    setManualOpen(true);
  };

  const adjustManual = (delta: number) => {
    const { min, max } = manualBounds();
    setManualValue((v) => {
      if (v === null) return v;
      const next = Math.min(max, Math.max(min, v + delta));
      setManualText(String(next));
      return next;
    });
  };

  const onManualTextChange = (text: string) => {
    setManualText(text.replace(/[^0-9]/g, '').slice(0, 2));
  };

  // 텍스트 입력을 확정해 clamp된 숫자로 되돌린다 — blur 시, 그리고 적용 버튼을 눌러
  // 아직 blur가 일어나지 않은 상태에서도 최신 입력값을 반영하기 위해 재사용한다.
  const commitManualText = (): number => {
    const { min, max } = manualBounds();
    const parsed = parseInt(manualText, 10);
    const base = manualValue ?? min;
    const next = Number.isNaN(parsed) ? base : Math.min(max, Math.max(min, parsed));
    setManualValue(next);
    setManualText(String(next));
    return next;
  };

  const onApplyManual = async () => {
    if (!ctx || manualValue === null || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const finalValue = commitManualText();
    const manualAdjustmentMinutes = finalValue - ctx.baseValue;
    await applyManualAdjustment(ctx.mode, finalValue);
    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      result: 'manual',
      manualAdjustmentMinutes,
    });
    await clearPendingFeedback();

    const label = ctx.mode === 'coffee' ? '카페인 발현시간' : '대기시간';
    router.replace({
      pathname: '/',
      params: { toast: `다음 ${modeName(ctx.mode)}은 ${label} ${finalValue}분으로 맞춰둘게요.` },
    });
  };

  if (!ctx) {
    return <View style={styles.container} />;
  }

  const { min: manualMin, max: manualMax } = manualBounds();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>낮잠 어땠어요?</Text>
        <Text style={styles.subtitle}>다음 낮잠 시간에 바로 반영돼요.</Text>
        {ctx.mode === 'coffee' ? (
          <Text style={styles.statusLine}>내 카페인 발현: {ctx.caffeineOnset}분</Text>
        ) : (
          <Text style={styles.statusLine}>
            내 수면 대기시간: 잠듦 {ctx.latency.fast}분 · 뒤척임 {ctx.latency.slow}분
          </Text>
        )}
      </View>

      <View style={styles.buttons}>
        {buildFeedbackOptions(ctx.mode, ctx.step).map((option) => (
          <Pressable
            key={option.feedback}
            onPress={() => onSelect(option.feedback)}
            style={({ pressed }) => [styles.optionBtn, pressed && styles.optionBtnPressed]}
          >
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionDetail}>{option.detail}</Text>
          </Pressable>
        ))}

        {!manualOpen && (
          <Pressable onPress={openManual} style={styles.manualLinkRow}>
            <Text style={styles.manualLinkText}>직접 조정하기</Text>
          </Pressable>
        )}

        {manualOpen && manualValue !== null && (
          <View style={styles.manualPanel}>
            <Pressable
              onPress={() => adjustManual(-MANUAL_STEP)}
              style={styles.manualStepBtn}
              accessibilityLabel="1분 줄이기"
            >
              <Text style={styles.manualStepText}>−</Text>
            </Pressable>
            <View style={styles.manualInputRow}>
              <TextInput
                style={[styles.manualInput, tabularNums]}
                value={manualText}
                onChangeText={onManualTextChange}
                onBlur={commitManualText}
                onSubmitEditing={commitManualText}
                keyboardType="number-pad"
                maxLength={2}
                textAlign="center"
                accessibilityLabel={`분 직접 입력 (${manualMin}~${manualMax})`}
              />
              <Text style={styles.manualUnitText}>분</Text>
            </View>
            <Pressable
              onPress={() => adjustManual(MANUAL_STEP)}
              style={styles.manualStepBtn}
              accessibilityLabel="1분 늘리기"
            >
              <Text style={styles.manualStepText}>+</Text>
            </Pressable>
            <Pressable onPress={onApplyManual} style={styles.manualApplyBtn}>
              <Text style={styles.manualApplyText}>적용</Text>
            </Pressable>
          </View>
        )}
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
  statusLine: {
    marginTop: 10,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
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
  manualLinkRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  manualLinkText: {
    fontSize: 13.5,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
    textDecorationLine: 'underline',
  },
  manualPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  manualStepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualStepText: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  manualInput: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: 2,
  },
  manualUnitText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  manualApplyBtn: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  manualApplyText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.surface,
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
