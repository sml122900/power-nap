import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  appendNapRecord,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  clearPendingFeedback,
  getPendingFeedback,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  type NapMode,
  type NapSurvey,
  type Settings,
  type SurveyRating,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

function modeName(mode: NapMode): string {
  if (mode === 'fast') return '바로 잠듦';
  if (mode === 'slow') return '뒤척임';
  return '커피냅';
}

type SurveyQuestionKey = keyof NapSurvey;

const QUESTIONS: { key: SurveyQuestionKey; label: string }[] = [
  { key: 'posture', label: '자세 편안함' },
  { key: 'noise', label: '소음 차단' },
  { key: 'light', label: '빛 차단' },
  { key: 'satisfaction', label: '수면 만족도' },
];

const RATINGS: { value: SurveyRating; label: string }[] = [
  { value: 'high', label: '상' },
  { value: 'mid', label: '중' },
  { value: 'low', label: '하' },
];

// 문항당 기본값을 '중'으로 깔아둔다 — 전부 보통이면 탭 없이 바로 제출도 가능하고,
// 다르게 느낀 문항만 골라 탭하면 되므로 최대 4탭 밀도를 유지한다.
const DEFAULT_SURVEY: NapSurvey = { posture: 'mid', noise: 'mid', light: 'mid', satisfaction: 'mid' };

const MANUAL_STEP = 1;

interface FeedbackContext {
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 실제 사용된 총 시간(분) — NapRecord용
  baseValue: number; // latency[mode] 또는 caffeineOnset — 매뉴얼 스테퍼 시작값
  latency: Settings['latency']; // 학습 상태 캡션용
  caffeineOnset: number; // 학습 상태 캡션용
}

export default function FeedbackScreen() {
  const router = useRouter();
  const [ctx, setCtx] = useState<FeedbackContext | null>(null);
  const [answers, setAnswers] = useState<NapSurvey>(DEFAULT_SURVEY);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState('');
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
        latency: settings.latency,
        caffeineOnset: settings.caffeineOnset,
      });
    });
  }, [router]);

  // 알람 화면으로는 절대 못 돌아가야 한다(§6.4) — 이 화면에 진입한 시점에 이미
  // ActiveNap이 지워져 있으므로 뒤로가기는 홈으로 보낸다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  const onSubmitSurvey = async () => {
    if (!ctx || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      survey: answers,
      memo: memoText.trim() || undefined,
    });
    await clearPendingFeedback();
    router.replace({ pathname: '/', params: { toast: '기록했어요.' } });
  };

  const onSkip = async () => {
    if (!ctx || submittingRef.current) return;
    submittingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      survey: null,
    });
    await clearPendingFeedback();
    router.replace('/');
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
    await applyManualAdjustment(ctx.mode, finalValue);
    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      manualAdjust: { source: 'feedback', beforeMinutes: ctx.baseValue, afterMinutes: finalValue },
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Text style={styles.title}>낮잠 어땠어요?</Text>
            <Text style={styles.subtitle}>짧게 체크만 해도 기록으로 남아요.</Text>
            {ctx.mode === 'coffee' ? (
              <Text style={styles.statusLine}>내 카페인 발현: {ctx.caffeineOnset}분</Text>
            ) : (
              <Text style={styles.statusLine}>
                내 수면 대기시간: 잠듦 {ctx.latency.fast}분 · 뒤척임 {ctx.latency.slow}분
              </Text>
            )}
          </View>

          <View style={styles.survey}>
            {QUESTIONS.map((question) => (
              <View key={question.key} style={styles.surveyRow}>
                <Text style={styles.surveyLabel}>{question.label}</Text>
                <View style={styles.segmentRow}>
                  {RATINGS.map((rating) => {
                    const selected = answers[question.key] === rating.value;
                    return (
                      <Pressable
                        key={rating.value}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setAnswers((a) => ({ ...a, [question.key]: rating.value }));
                        }}
                        style={[styles.segmentBtn, selected && styles.segmentBtnSelected]}
                        accessibilityRole="button"
                        accessibilityLabel={`${question.label} ${rating.label}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextSelected]}>
                          {rating.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          {!memoOpen && (
            <Pressable onPress={() => setMemoOpen(true)} style={styles.memoLinkRow}>
              <Text style={styles.memoLinkText}>메모 남기기</Text>
            </Pressable>
          )}
          {memoOpen && (
            <TextInput
              style={styles.memoInput}
              value={memoText}
              onChangeText={setMemoText}
              placeholder="남기고 싶은 것"
              placeholderTextColor={colors.inkFaint}
              multiline
            />
          )}

          <Pressable onPress={onSubmitSurvey} style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}>
            <Text style={styles.submitBtnText}>기록하기</Text>
          </Pressable>

          <Pressable onPress={onSkip} style={styles.skipLinkRow}>
            <Text style={styles.skipLinkText}>건너뛰기</Text>
          </Pressable>

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

          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              <Text style={styles.tipTextBold}>개운하게 깨는 법</Text> — 기지개 켜기 → 밝은 빛 쬐기 → 물 한 잔. 3가지면
              수면 관성이 빨리 풀려요.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  head: {
    marginTop: 28,
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
  survey: {
    marginTop: 32,
    gap: 20,
  },
  surveyRow: {
    gap: 8,
  },
  surveyLabel: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // DESIGN_HANDOFF: 새 색 추가 없이 선택 상태를 ink 배경/흰 글자로 반전만 시킨다.
  segmentBtnSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  segmentBtnText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  segmentBtnTextSelected: {
    color: colors.surface,
  },
  memoLinkRow: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  memoLinkText: {
    fontSize: 13.5,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
    textDecorationLine: 'underline',
  },
  memoInput: {
    marginTop: 20,
    minHeight: 72,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  submitBtn: {
    marginTop: 24,
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnPressed: {
    backgroundColor: colors.brandPress,
  },
  submitBtnText: {
    fontSize: 17,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.34,
    color: colors.surface,
  },
  skipLinkRow: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipLinkText: {
    fontSize: 13.5,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  manualLinkRow: {
    marginTop: 8,
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
    marginTop: 24,
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
