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
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
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
  type WakeChecklist,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

function modeName(mode: NapMode): string {
  return i18n.t(`common:napMode.${mode}`);
}

type SurveyQuestionKey = keyof NapSurvey;

const QUESTIONS: { key: SurveyQuestionKey; questionKey: string }[] = [
  { key: 'posture', questionKey: 'question.posture' },
  { key: 'noise', questionKey: 'question.noise' },
  { key: 'light', questionKey: 'question.light' },
  { key: 'satisfaction', questionKey: 'question.satisfaction' },
];

const RATINGS: { value: SurveyRating; ratingKey: string }[] = [
  { value: 'high', ratingKey: 'common:rating.high' },
  { value: 'mid', ratingKey: 'common:rating.mid' },
  { value: 'low', ratingKey: 'common:rating.low' },
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
  // 기상 루틴 3화면(/wake-stretch 등)에서 이미 채워 넘어온 값 — 이 화면은 그대로
  // NapRecord에 실어보내기만 한다(체크박스 UI 없음, wake-sequence 변경 이후).
  wakeChecklist?: WakeChecklist;
  // 테스트 낮잠(홈 화면 단축 버튼) 여부 — ActiveNap.isTest가 PendingFeedback을 거쳐
  // 여기까지 승계된다. 사용자 지시로 테스트 낮잠도 이 화면까지 실제 알람과 동일하게
  // 도달하지만, "직접 조정하기"의 실제 저장(applyManualAdjustment)과 AI 분석 대상
  // 포함(filterAnalyzableRecords) 두 곳에서만 막는다 — 그 외 UI/동작은 완전히 동일.
  isTest?: boolean;
}

export default function FeedbackScreen() {
  const router = useRouter();
  const { t } = useTranslation('feedback');
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
        wakeChecklist: pending.wakeChecklist,
        isTest: pending.isTest,
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
      wakeChecklist: ctx.wakeChecklist,
      isTest: ctx.isTest,
    });
    await clearPendingFeedback();
    router.replace({ pathname: '/', params: { toast: t('toastRecorded') } });
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
      wakeChecklist: ctx.wakeChecklist,
      isTest: ctx.isTest,
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
    // 테스트 낮잠은 학습값을 실제로 바꾸지 않는다(CLAUDE.md 지뢰 목록 "테스트 낮잠이
    // latency를 오염시킨" 사고 재발 방지, 사용자 지시) — UI/기록은 실제 알람과 동일하게
    // 남기되 applyManualAdjustment만 건너뛰고, 안 바뀌었다는 걸 토스트로 알린다.
    if (!ctx.isTest) {
      await applyManualAdjustment(ctx.mode, finalValue);
    }
    await appendNapRecord({
      completedAt: Date.now(),
      mode: ctx.mode,
      offsetMinutes: ctx.offsetMinutes,
      manualAdjust: { source: 'feedback', beforeMinutes: ctx.baseValue, afterMinutes: finalValue },
      wakeChecklist: ctx.wakeChecklist,
      isTest: ctx.isTest,
    });
    await clearPendingFeedback();

    const label = t(ctx.mode === 'coffee' ? 'manualLabelCaffeine' : 'manualLabelLatency');
    const toast = ctx.isTest
      ? t('toastManualAdjustTestSkipped')
      : t('toastManualAdjust', { modeName: modeName(ctx.mode), label, minutes: finalValue });
    router.replace({ pathname: '/', params: { toast } });
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
            <Text style={styles.title}>{t('title')}</Text>
            <Text style={styles.subtitle}>{t('subtitle')}</Text>
            {ctx.mode === 'coffee' ? (
              <Text style={styles.statusLine}>{t('statusCoffee', { minutes: ctx.caffeineOnset })}</Text>
            ) : (
              <Text style={styles.statusLine}>
                {t('statusDefault', { fast: ctx.latency.fast, slow: ctx.latency.slow })}
              </Text>
            )}
          </View>

          <View style={styles.survey}>
            {QUESTIONS.map((question) => (
              <View key={question.key} style={styles.surveyRow}>
                <Text style={styles.surveyLabel}>{t(question.questionKey)}</Text>
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
                        accessibilityLabel={`${t(question.questionKey)} ${t(rating.ratingKey)}`}
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextSelected]}>
                          {t(rating.ratingKey)}
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
              <Text style={styles.memoLinkText}>{t('memoLink')}</Text>
            </Pressable>
          )}
          {memoOpen && (
            <TextInput
              style={styles.memoInput}
              value={memoText}
              onChangeText={setMemoText}
              placeholder={t('memoPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              multiline
            />
          )}

          <Pressable onPress={onSubmitSurvey} style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}>
            <Text style={styles.submitBtnText}>{t('submit')}</Text>
          </Pressable>

          <Pressable onPress={onSkip} style={styles.skipLinkRow}>
            <Text style={styles.skipLinkText}>{t('skip')}</Text>
          </Pressable>

          {!manualOpen && (
            <Pressable onPress={openManual} style={styles.manualLinkRow}>
              <Text style={styles.manualLinkText}>{t('manualLink')}</Text>
            </Pressable>
          )}

          {manualOpen && manualValue !== null && (
            <View style={styles.manualPanel}>
              <Pressable
                onPress={() => adjustManual(-MANUAL_STEP)}
                style={styles.manualStepBtn}
                accessibilityLabel={t('manualDecreaseA11y')}
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
                  accessibilityLabel={t('manualInputA11y', { min: manualMin, max: manualMax })}
                />
                <Text style={styles.manualUnitText}>{t('manualUnit')}</Text>
              </View>
              <Pressable
                onPress={() => adjustManual(MANUAL_STEP)}
                style={styles.manualStepBtn}
                accessibilityLabel={t('manualIncreaseA11y')}
              >
                <Text style={styles.manualStepText}>+</Text>
              </Pressable>
              <Pressable onPress={onApplyManual} style={styles.manualApplyBtn}>
                <Text style={styles.manualApplyText}>{t('manualApply')}</Text>
              </Pressable>
            </View>
          )}
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
});
