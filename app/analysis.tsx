import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import {
  getAnalysisDetail,
  isAnalysisError,
  requestAnalysis,
  requestFollowup,
  type AnalysisReport,
} from '@/aiAnalysis';
import { formatFreeResetCountdown, turnsToExchanges, type FollowupExchange } from '@/analysisDisplay';
import {
  appendNapRecord,
  applyManualAdjustment,
  computeSuggestionApplication,
  filterAnalyzableRecords,
  getNapRecords,
  getSettings,
  TARGET_SLEEP_MIN,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useFreeResetStatus } from '@/useFreeResetStatus';

type Phase = 'loading' | 'report' | 'insufficient_credit' | 'error';

export default function AnalysisScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation('analysisReport');
  const params = useLocalSearchParams<{ id?: string; since?: string }>();
  const requestKey = params.id ? `history:${params.id}` : `fresh:${params.since ?? ''}`;

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [analysisId, setAnalysisId] = useState<number | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [recordsUsed, setRecordsUsed] = useState(0);
  // 지난 분석 열람(params.id)이면 실제 저장된 locale, 새 분석(params.since)이면 방금 요청에
  // 쓴 현재 앱 언어 그대로다(Edge Function 응답 바디엔 locale이 없음 — 어차피 항상 같음).
  // 재번역은 하지 않는다(AI_ANALYSIS.md §5 근거) — 이 값은 "다른 언어로 쓰였다"는 안내에만 쓴다.
  const [reportLocale, setReportLocale] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [appliedFast, setAppliedFast] = useState(false);
  const [appliedSlow, setAppliedSlow] = useState(false);
  const [appliedCaffeine, setAppliedCaffeine] = useState(false);

  const [exchanges, setExchanges] = useState<FollowupExchange[]>([]);
  const [turnsRemaining, setTurnsRemaining] = useState(0);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);

  // 402(무료 소진) 상태일 때만 상태를 조회한다 — 로딩/리포트 화면에서는 불필요한 서버 호출.
  const freeReset = useFreeResetStatus(phase === 'insufficient_credit');

  // id(지난 분석 열람)/since(새 분석, 기간 필터)가 바뀔 때마다 완전히 다시 로드한다 —
  // 화면 인스턴스가 재사용될 수 있어(history → history 다른 id로 이동 등) useRef 1회성
  // 가드 대신 requestKey를 의존성으로 둔다. 매번 적용 상태/대화도 초기화한다.
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setAppliedFast(false);
    setAppliedSlow(false);
    setAppliedCaffeine(false);
    setReportLocale(null);
    setExchanges([]);
    setQuestion('');

    (async () => {
      const currentSettings = await getSettings();
      if (cancelled) return;
      setSettings(currentSettings);

      if (params.id) {
        const detail = await getAnalysisDetail(Number(params.id));
        if (cancelled) return;
        if (!detail) {
          setErrorMessage(t('detailLoadError'));
          setPhase('error');
          return;
        }
        setAnalysisId(detail.id);
        setReport(detail.report);
        setRecordsUsed(detail.recordsUsed);
        setReportLocale(detail.locale);
        setExchanges(turnsToExchanges(detail.turns));
        setTurnsRemaining(detail.turnsRemaining);
        setPhase('report');
        return;
      }

      const allRecords = await getNapRecords();
      if (cancelled) return;
      const sinceMs = params.since ? Number(params.since) : undefined;
      const filtered = filterAnalyzableRecords(allRecords, sinceMs);
      try {
        const analysis = await requestAnalysis(filtered, currentSettings);
        if (cancelled) return;
        setAnalysisId(analysis.analysisId);
        setReport(analysis.report);
        setRecordsUsed(analysis.recordsUsed);
        setReportLocale(i18n.language);
        setTurnsRemaining(analysis.turnsRemaining);
        setPhase('report');
      } catch (err) {
        if (cancelled) return;
        if (isAnalysisError(err) && err.code === 'insufficient_credit') {
          setPhase('insufficient_credit');
        } else {
          setErrorMessage(isAnalysisError(err) ? err.message : t('errorFallback'));
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const applyLatency = async (mode: 'fast' | 'slow', delta: number) => {
    if (!settings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { before, after } = computeSuggestionApplication(mode, settings.latency[mode], delta);
    const updated = await applyManualAdjustment(mode, after);
    setSettings(updated);
    await appendNapRecord({
      completedAt: Date.now(),
      mode,
      offsetMinutes: TARGET_SLEEP_MIN + after,
      manualAdjust: { source: 'ai-analysis', beforeMinutes: before, afterMinutes: after },
    });
    if (mode === 'fast') setAppliedFast(true);
    else setAppliedSlow(true);
  };

  const applyCaffeineOnset = async (delta: number) => {
    if (!settings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { before, after } = computeSuggestionApplication('coffee', settings.caffeineOnset, delta);
    const updated = await applyManualAdjustment('coffee', after);
    setSettings(updated);
    await appendNapRecord({
      completedAt: Date.now(),
      mode: 'coffee',
      offsetMinutes: after,
      manualAdjust: { source: 'ai-analysis', beforeMinutes: before, afterMinutes: after },
    });
    setAppliedCaffeine(true);
  };

  const onAsk = async () => {
    if (analysisId === null || !question.trim() || asking || turnsRemaining <= 0) return;
    setAsking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const askedQuestion = question.trim();
    try {
      const followup = await requestFollowup(analysisId, askedQuestion);
      setExchanges((prev) => [...prev, { question: askedQuestion, answer: followup.answer }]);
      setTurnsRemaining(followup.turnsRemaining);
      setQuestion('');
    } catch {
      // 후속 질문 실패는 조용히 무시 — 리포트 자체는 이미 받았으니 화면을 깨지 않는다.
    } finally {
      setAsking(false);
    }
  };

  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.brand} />
        <Text style={styles.loadingText}>{t('loadingText')}</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'insufficient_credit') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('title')}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>{t('common:close')}</Text>
          </Pressable>
        </View>
        <View style={styles.centerBody}>
          <Text style={styles.paragraph}>{t('insufficientCreditMessage')}</Text>
          {freeReset.remainingMs !== null && (
            <Text style={styles.countdownText}>
              {t('insufficientCreditCountdown', { time: formatFreeResetCountdown(freeReset.remainingMs) })}
            </Text>
          )}
          <View style={styles.paymentPlaceholder}>
            <Text style={styles.paymentPlaceholderText}>{t('paymentPlaceholder')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error' || !report) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('title')}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>{t('common:close')}</Text>
          </Pressable>
        </View>
        <View style={styles.centerBody}>
          <Text style={styles.paragraph}>{errorMessage || t('errorFallback')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Text style={styles.title}>{t('title')}</Text>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.closeText}>{t('common:close')}</Text>
            </Pressable>
          </View>

          <Text style={styles.recordsUsedText}>{t('recordsUsedText', { count: recordsUsed })}</Text>
          {reportLocale && reportLocale !== i18n.language && (
            <Text style={styles.languageNotice}>
              {t('reportLanguageNotice', { language: t(`settings:languageOption.${reportLocale}`) })}
            </Text>
          )}
          <Text style={styles.summary}>{report.summary}</Text>

          <View style={styles.adviceList}>
            {report.advice.map((line, i) => (
              <Text key={i} style={styles.adviceLine}>
                {line}
              </Text>
            ))}
          </View>

          {report.latencyAdjust && (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>{t('suggestion.latencyTitle')}</Text>
              <SuggestionRow
                label={t('suggestion.fastLabel', {
                  sign: report.latencyAdjust.fast > 0 ? '+' : '',
                  minutes: report.latencyAdjust.fast,
                })}
                applied={appliedFast}
                onApply={() => applyLatency('fast', report.latencyAdjust!.fast)}
              />
              <SuggestionRow
                label={t('suggestion.slowLabel', {
                  sign: report.latencyAdjust.slow > 0 ? '+' : '',
                  minutes: report.latencyAdjust.slow,
                })}
                applied={appliedSlow}
                onApply={() => applyLatency('slow', report.latencyAdjust!.slow)}
              />
            </View>
          )}

          {report.caffeineOnsetAdjust !== null && (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>{t('suggestion.caffeineTitle')}</Text>
              <SuggestionRow
                label={t('suggestion.caffeineLabel', {
                  sign: report.caffeineOnsetAdjust > 0 ? '+' : '',
                  minutes: report.caffeineOnsetAdjust,
                })}
                applied={appliedCaffeine}
                onApply={() => applyCaffeineOnset(report.caffeineOnsetAdjust!)}
              />
            </View>
          )}

          <Text style={styles.disclaimer}>{t('disclaimer')}</Text>

          <View style={styles.followupSection}>
            <Text style={styles.followupTitle}>{t('followupTitle', { count: turnsRemaining })}</Text>
            {exchanges.map((ex, i) => (
              <View key={i} style={styles.exchange}>
                <Text style={styles.exchangeQuestion}>{ex.question}</Text>
                <Text style={styles.exchangeAnswer}>{ex.answer}</Text>
              </View>
            ))}
            {turnsRemaining > 0 && (
              <View style={styles.askRow}>
                <TextInput
                  style={styles.askInput}
                  value={question}
                  onChangeText={setQuestion}
                  placeholder={t('askPlaceholder')}
                  placeholderTextColor={colors.inkFaint}
                  editable={!asking}
                  onSubmitEditing={onAsk}
                />
                <Pressable onPress={onAsk} disabled={asking || !question.trim()} style={styles.askBtn}>
                  <Text style={styles.askBtnText}>{asking ? t('askButtonSending') : t('askButton')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SuggestionRow({ label, applied, onApply }: { label: string; applied: boolean; onApply: () => void }) {
  const { t } = useTranslation('analysisReport');
  return (
    <View style={styles.suggestionRow}>
      <Text style={styles.suggestionLabel}>{label}</Text>
      <Pressable onPress={onApply} disabled={applied} style={[styles.applyBtn, applied && styles.applyBtnDone]}>
        <Text style={[styles.applyBtnText, applied && styles.applyBtnTextDone]}>
          {applied ? t('suggestion.applied') : t('suggestion.apply')}
        </Text>
      </Pressable>
    </View>
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.surface,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  centerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
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
  paragraph: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  countdownText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  paymentPlaceholder: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    opacity: 0.6,
  },
  paymentPlaceholderText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
  recordsUsedText: {
    marginTop: 24,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  languageNotice: {
    marginTop: 6,
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.amber,
  },
  summary: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fontFamily.regular,
    color: colors.ink,
  },
  adviceList: {
    marginTop: 20,
    gap: 12,
  },
  adviceLine: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  suggestionCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    gap: 12,
  },
  suggestionTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  suggestionLabel: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  applyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  applyBtnDone: {
    backgroundColor: colors.bg,
  },
  applyBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.surface,
  },
  applyBtnTextDone: {
    color: colors.inkFaint,
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
  followupSection: {
    marginTop: 28,
    gap: 16,
  },
  followupTitle: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  exchange: {
    gap: 6,
  },
  exchangeQuestion: {
    fontSize: 13.5,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  exchangeAnswer: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  askRow: {
    flexDirection: 'row',
    gap: 8,
  },
  askInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.ink,
  },
  askBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  askBtnText: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.surface,
  },
});
