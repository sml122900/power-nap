import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { formatFreeResetCountdown } from '@/analysisDisplay';
import { formatDateTime } from '@/format';
import i18n from '@/i18n';
import {
  canRunAnalysis,
  filterAnalyzableRecords,
  getAiConsent,
  getNapRecords,
  MIN_RECORDS_FOR_ANALYSIS,
  type NapMode,
  type NapRecord,
  type NapRecordResult,
  type NapSurvey,
  type SurveyRating,
  type WakeChecklist,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useFreeResetStatus } from '@/useFreeResetStatus';

// 아래 순수 함수(modeName/resultLabel/surveySummary/wakeChecklistSummary/detailText/detailRows)는
// history.test.ts가 직접 호출해 검증한다 — 화면 컴포넌트 밖이라 useTranslation() 훅을 못 쓰고
// 전역 i18n 인스턴스(@/i18n)의 t()를 그대로 쓴다(리액트 렌더와 무관하게 항상 최신 언어를 반영).
function modeName(mode: NapMode): string {
  return i18n.t(`common:napMode.${mode}`);
}

function resultLabel(result: NapRecordResult): string {
  return i18n.t(`history:resultLabel.${result}`);
}

const RATING_KEYS: Record<SurveyRating, string> = { high: 'common:rating.high', mid: 'common:rating.mid', low: 'common:rating.low' };

export function surveySummary(survey: NapSurvey): string {
  return i18n.t('history:surveySummary', {
    posture: i18n.t(RATING_KEYS[survey.posture]),
    noise: i18n.t(RATING_KEYS[survey.noise]),
    light: i18n.t(RATING_KEYS[survey.light]),
    satisfaction: i18n.t(RATING_KEYS[survey.satisfaction]),
  });
}

const WAKE_CHECKLIST_LABEL: { key: keyof WakeChecklist; labelKey: string }[] = [
  { key: 'immediate', labelKey: 'history:wakeChecklist.immediate' },
  { key: 'stretch', labelKey: 'history:wakeChecklist.stretch' },
  { key: 'light', labelKey: 'history:wakeChecklist.light' },
  { key: 'water', labelKey: 'history:wakeChecklist.water' },
];

// 체크된 항목만 라벨을 이어붙인다 — appendNapRecord가 전부 미체크면 필드를 생략하므로
// 여기 도달했다면 최소 1개는 체크된 상태.
export function wakeChecklistSummary(checklist: WakeChecklist): string {
  return WAKE_CHECKLIST_LABEL.filter((item) => checklist[item.key])
    .map((item) => i18n.t(item.labelKey))
    .join(' · ');
}

function resultSuffix(minutes: number): string {
  return i18n.t('history:resultSuffix', { sign: minutes > 0 ? '+' : '', minutes });
}

function manualAdjustLabel(source: 'settings' | 'feedback' | 'ai-analysis'): string {
  return i18n.t(`history:manualAdjustLabel.${source === 'settings' ? 'settings' : 'feedback'}`);
}

// v1(레거시 3버튼 후기/직접조정)과 v2(Phase 4-3 설문/수동조정) 포맷이 한 히스토리에
// 공존한다 — result가 있으면 v1, 없으면 v2로 판정한다(store.ts NapRecord 참고).
export function detailText(item: NapRecord): string {
  if (item.result !== undefined) {
    const suffix =
      (item.result === 'manual' || item.result === 'manual-settings') && item.manualAdjustmentMinutes !== undefined
        ? resultSuffix(item.manualAdjustmentMinutes)
        : '';
    return `${resultLabel(item.result)}${suffix}`;
  }
  if (item.manualAdjust) {
    return i18n.t('history:manualAdjustValue', {
      label: manualAdjustLabel(item.manualAdjust.source),
      before: item.manualAdjust.beforeMinutes,
      after: item.manualAdjust.afterMinutes,
    });
  }
  if (item.survey === null) return i18n.t('history:surveySkipped');
  if (item.survey) return surveySummary(item.survey);
  return '';
}

export interface DetailRow {
  label: string;
  value: string;
}

// 리스트 행 탭 시 펼쳐지는 상세 뷰 전용 — 압축된 detailText()와 달리 설문 4항목을
// 풀네임 라벨로 한 줄씩 나열한다("자세: 중" 등). manualAdjust/memo는 존재할 때만 추가.
export function detailRows(item: NapRecord): DetailRow[] {
  const rows: DetailRow[] = [
    { label: i18n.t('history:detailRow.date'), value: formatDateTime(new Date(item.completedAt)) },
    { label: i18n.t('history:detailRow.mode'), value: modeName(item.mode) },
    { label: i18n.t('history:detailRow.duration'), value: i18n.t('history:detailRow.durationValue', { minutes: item.offsetMinutes }) },
  ];

  if (item.result !== undefined) {
    const suffix =
      (item.result === 'manual' || item.result === 'manual-settings') && item.manualAdjustmentMinutes !== undefined
        ? resultSuffix(item.manualAdjustmentMinutes)
        : '';
    rows.push({ label: i18n.t('history:detailRow.feedbackResult'), value: `${resultLabel(item.result)}${suffix}` });
  } else if (item.survey) {
    rows.push(
      { label: i18n.t('history:detailRow.posture'), value: i18n.t(RATING_KEYS[item.survey.posture]) },
      { label: i18n.t('history:detailRow.noise'), value: i18n.t(RATING_KEYS[item.survey.noise]) },
      { label: i18n.t('history:detailRow.light'), value: i18n.t(RATING_KEYS[item.survey.light]) },
      { label: i18n.t('history:detailRow.satisfaction'), value: i18n.t(RATING_KEYS[item.survey.satisfaction]) }
    );
  } else if (item.survey === null) {
    rows.push({ label: i18n.t('history:detailRow.survey'), value: i18n.t('history:detailRow.surveySkippedValue') });
  }

  if (item.manualAdjust) {
    rows.push({
      label: i18n.t('history:detailRow.manualAdjust'),
      value: i18n.t('history:manualAdjustValue', {
        label: manualAdjustLabel(item.manualAdjust.source),
        before: item.manualAdjust.beforeMinutes,
        after: item.manualAdjust.afterMinutes,
      }),
    });
  }

  if (item.memo) {
    rows.push({ label: i18n.t('history:detailRow.memo'), value: item.memo });
  }

  if (item.wakeChecklist) {
    rows.push({ label: i18n.t('history:detailRow.wakeRoutine'), value: wakeChecklistSummary(item.wakeChecklist) });
  }

  return rows;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation('history');
  const [records, setRecords] = useState<NapRecord[]>([]);
  // 한 번에 하나만 펼친다(아코디언) — completedAt이 유니크 키.
  const [expanded, setExpanded] = useState<number | null>(null);
  const [consented, setConsented] = useState<boolean | null>(null);

  useEffect(() => {
    getNapRecords().then((r) => setRecords([...r].reverse()));
    getAiConsent().then(setConsented);
  }, []);

  // isTest 레코드는 학습에 반영되지 않는 것과 동일하게 분석 가능 여부 판정에서도 뺀다.
  const canAnalyze = canRunAnalysis(filterAnalyzableRecords(records).length);
  // 동의 전에는 서버 호출 자체를 안 한다(전송 동의 원칙) — 동의 후 + 분석 가능할 때만 조회.
  const freeReset = useFreeResetStatus(consented === true && canAnalyze);

  const onPressAiAnalysis = async () => {
    if (!canAnalyze) return;
    router.push(consented === true ? '/analysis-period' : '/analysis-consent');
  };

  const freeStatusCaption =
    freeReset.hasWeeklyFree === true
      ? t('freeAvailable')
      : freeReset.remainingMs !== null
        ? t('freeCountdown', { time: formatFreeResetCountdown(freeReset.remainingMs) })
        : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>{t('common:close')}</Text>
        </Pressable>
      </View>

      <View style={styles.aiAnalysisSection}>
        <Pressable
          onPress={onPressAiAnalysis}
          disabled={!canAnalyze}
          style={styles.aiAnalysisRow}
          accessibilityRole="button"
          accessibilityLabel={t('aiAnalysisLabel')}
          accessibilityState={{ disabled: !canAnalyze }}
        >
          <Text style={[styles.aiAnalysisText, !canAnalyze && styles.aiAnalysisTextDisabled]}>
            {t('aiAnalysisLabel')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/analysis-history')}
          style={styles.aiHistoryRow}
          accessibilityRole="button"
          accessibilityLabel={t('aiHistoryLabel')}
        >
          <Text style={styles.aiHistoryText}>{t('aiHistoryLabel')}</Text>
        </Pressable>
      </View>
      {!canAnalyze && (
        <Text style={styles.aiAnalysisCaption}>
          {t('aiAnalysisCaptionMin', { count: MIN_RECORDS_FOR_ANALYSIS })}
        </Text>
      )}
      {canAnalyze && consented === true && freeStatusCaption && (
        <Text style={styles.aiAnalysisCaption}>{freeStatusCaption}</Text>
      )}

      {records.length === 0 ? (
        <Text style={styles.emptyText}>{t('emptyText')}</Text>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.completedAt)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isExpanded = expanded === item.completedAt;
            return (
              <Pressable
                style={styles.row}
                onPress={() => setExpanded(isExpanded ? null : item.completedAt)}
                accessibilityRole="button"
                accessibilityLabel={t('rowDetailA11y')}
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.rowDate}>{formatDateTime(new Date(item.completedAt))}</Text>
                  {item.isTest && (
                    <View style={styles.testBadge}>
                      <Text style={styles.testBadgeText}>{t('testBadge')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowDetail}>
                  {modeName(item.mode)} ·{' '}
                  <Text style={tabularNums}>{t('detailRow.durationValue', { minutes: item.offsetMinutes })}</Text> ·{' '}
                  {detailText(item)}
                </Text>
                {item.memo && !isExpanded && <Text style={styles.memoText}>"{item.memo}"</Text>}

                {isExpanded && (
                  <View style={styles.detailBlock}>
                    {detailRows(item).map((row) => (
                      <Text key={row.label} style={styles.detailLine}>
                        <Text style={styles.detailLabel}>{row.label}: </Text>
                        {row.value}
                      </Text>
                    ))}
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiAnalysisSection: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  aiAnalysisRow: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAnalysisText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.brand,
  },
  aiAnalysisTextDisabled: {
    color: colors.inkFaint,
  },
  aiHistoryRow: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHistoryText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  aiAnalysisCaption: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
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
  emptyText: {
    marginTop: 44,
    textAlign: 'center',
    fontSize: 14.5,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
  list: {
    marginTop: 24,
    gap: 10,
  },
  row: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDate: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  testBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
  rowDetail: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  memoText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
    fontStyle: 'italic',
  },
  detailBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 6,
  },
  detailLine: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.ink,
  },
  detailLabel: {
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
});
