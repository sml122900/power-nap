import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { isAnalysisError, requestAnalysis, requestFollowup, type AnalysisReport, type AnalysisResult } from '@/aiAnalysis';
import {
  appendNapRecord,
  applyManualAdjustment,
  computeSuggestionApplication,
  getNapRecords,
  getSettings,
  TARGET_SLEEP_MIN,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius } from '@/theme';

type Phase = 'loading' | 'report' | 'insufficient_credit' | 'error';

interface FollowupExchange {
  question: string;
  answer: string;
}

export default function AnalysisScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [appliedFast, setAppliedFast] = useState(false);
  const [appliedSlow, setAppliedSlow] = useState(false);
  const [appliedCaffeine, setAppliedCaffeine] = useState(false);

  const [exchanges, setExchanges] = useState<FollowupExchange[]>([]);
  const [turnsRemaining, setTurnsRemaining] = useState(0);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const [records, currentSettings] = await Promise.all([getNapRecords(), getSettings()]);
      setSettings(currentSettings);
      try {
        const analysis = await requestAnalysis(records, currentSettings);
        setResult(analysis);
        setTurnsRemaining(analysis.turnsRemaining);
        setPhase('report');
      } catch (err) {
        if (isAnalysisError(err) && err.code === 'insufficient_credit') {
          setPhase('insufficient_credit');
        } else {
          setErrorMessage(isAnalysisError(err) ? err.message : '분석 요청에 실패했다.');
          setPhase('error');
        }
      }
    })();
  }, []);

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
    if (!result || !question.trim() || asking || turnsRemaining <= 0) return;
    setAsking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const askedQuestion = question.trim();
    try {
      const followup = await requestFollowup(result.analysisId, askedQuestion);
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
        <Text style={styles.loadingText}>낮잠 기록을 분석하고 있어요…</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'insufficient_credit') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Text style={styles.title}>AI 분석</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <View style={styles.centerBody}>
          <Text style={styles.paragraph}>이번 주 무료 분석을 사용했어요.</Text>
          <View style={styles.paymentPlaceholder}>
            <Text style={styles.paymentPlaceholderText}>추가 분석 1,000원 (준비 중)</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error' || !result) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.head}>
          <Text style={styles.title}>AI 분석</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </View>
        <View style={styles.centerBody}>
          <Text style={styles.paragraph}>{errorMessage || '분석 요청에 실패했다. 다시 시도해달라.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const report: AnalysisReport = result.report;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Text style={styles.title}>AI 분석</Text>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>

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
              <Text style={styles.suggestionTitle}>수면 대기시간 조정 제안</Text>
              <SuggestionRow
                label={`바로 잠듦 ${report.latencyAdjust.fast > 0 ? '+' : ''}${report.latencyAdjust.fast}분`}
                applied={appliedFast}
                onApply={() => applyLatency('fast', report.latencyAdjust!.fast)}
              />
              <SuggestionRow
                label={`뒤척임 ${report.latencyAdjust.slow > 0 ? '+' : ''}${report.latencyAdjust.slow}분`}
                applied={appliedSlow}
                onApply={() => applyLatency('slow', report.latencyAdjust!.slow)}
              />
            </View>
          )}

          {report.caffeineOnsetAdjust !== null && (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>카페인 발현시간 조정 제안</Text>
              <SuggestionRow
                label={`${report.caffeineOnsetAdjust > 0 ? '+' : ''}${report.caffeineOnsetAdjust}분`}
                applied={appliedCaffeine}
                onApply={() => applyCaffeineOnset(report.caffeineOnsetAdjust!)}
              />
            </View>
          )}

          <Text style={styles.disclaimer}>
            이 리포트는 일반적인 수면 위생 정보이며 의학적 진단이나 조언이 아닙니다. 증상이 지속되면 전문가와
            상담해주세요.
          </Text>

          <View style={styles.followupSection}>
            <Text style={styles.followupTitle}>후속 질문 ({turnsRemaining}번 남음)</Text>
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
                  placeholder="궁금한 점을 물어보세요"
                  placeholderTextColor={colors.inkFaint}
                  editable={!asking}
                  onSubmitEditing={onAsk}
                />
                <Pressable onPress={onAsk} disabled={asking || !question.trim()} style={styles.askBtn}>
                  <Text style={styles.askBtnText}>{asking ? '전송 중' : '질문하기'}</Text>
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
  return (
    <View style={styles.suggestionRow}>
      <Text style={styles.suggestionLabel}>{label}</Text>
      <Pressable onPress={onApply} disabled={applied} style={[styles.applyBtn, applied && styles.applyBtnDone]}>
        <Text style={[styles.applyBtnText, applied && styles.applyBtnTextDone]}>{applied ? '적용됨' : '설정에 반영하기'}</Text>
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
  summary: {
    marginTop: 24,
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
