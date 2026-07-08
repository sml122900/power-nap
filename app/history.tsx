import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatKoreanDateTime } from '@/format';
import {
  getNapRecords,
  type NapMode,
  type NapRecord,
  type NapRecordResult,
  type NapSurvey,
  type SurveyRating,
  type WakeChecklist,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

function modeName(mode: NapMode): string {
  if (mode === 'fast') return '바로 잠듦';
  if (mode === 'slow') return '뒤척임';
  return '커피냅';
}

function resultLabel(result: NapRecordResult): string {
  switch (result) {
    case 'tooDeep':
      return '너무 깊게 잤어요';
    case 'justRight':
      return '딱 좋았어요';
    case 'notEnough':
      return '아직 부족해요';
    case 'manual':
      return '직접 조정';
    case 'manual-settings':
      return '설정에서 조정';
    case 'test':
      return '테스트';
  }
}

const RATING_LABEL: Record<SurveyRating, string> = { high: '상', mid: '중', low: '하' };

export function surveySummary(survey: NapSurvey): string {
  return `자세${RATING_LABEL[survey.posture]} 소음${RATING_LABEL[survey.noise]} 빛${RATING_LABEL[survey.light]} · 만족${RATING_LABEL[survey.satisfaction]}`;
}

const WAKE_CHECKLIST_LABEL: { key: keyof WakeChecklist; label: string }[] = [
  { key: 'immediate', label: '즉시 기상' },
  { key: 'stretch', label: '기지개' },
  { key: 'light', label: '빛' },
  { key: 'water', label: '물' },
];

// 체크된 항목만 라벨을 이어붙인다 — appendNapRecord가 전부 미체크면 필드를 생략하므로
// 여기 도달했다면 최소 1개는 체크된 상태.
export function wakeChecklistSummary(checklist: WakeChecklist): string {
  return WAKE_CHECKLIST_LABEL.filter((item) => checklist[item.key])
    .map((item) => item.label)
    .join(' · ');
}

// v1(레거시 3버튼 후기/직접조정)과 v2(Phase 4-3 설문/수동조정) 포맷이 한 히스토리에
// 공존한다 — result가 있으면 v1, 없으면 v2로 판정한다(store.ts NapRecord 참고).
export function detailText(item: NapRecord): string {
  if (item.result !== undefined) {
    const suffix =
      (item.result === 'manual' || item.result === 'manual-settings') && item.manualAdjustmentMinutes !== undefined
        ? ` (${item.manualAdjustmentMinutes > 0 ? '+' : ''}${item.manualAdjustmentMinutes}분)`
        : '';
    return `${resultLabel(item.result)}${suffix}`;
  }
  if (item.manualAdjust) {
    const sourceLabel = item.manualAdjust.source === 'settings' ? '설정에서 조정' : '직접 조정';
    return `${sourceLabel} (${item.manualAdjust.beforeMinutes}→${item.manualAdjust.afterMinutes}분)`;
  }
  if (item.survey === null) return '설문 건너뜀';
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
    { label: '날짜', value: formatKoreanDateTime(new Date(item.completedAt)) },
    { label: '모드', value: modeName(item.mode) },
    { label: '사용 시간', value: `${item.offsetMinutes}분` },
  ];

  if (item.result !== undefined) {
    const suffix =
      (item.result === 'manual' || item.result === 'manual-settings') && item.manualAdjustmentMinutes !== undefined
        ? ` (${item.manualAdjustmentMinutes > 0 ? '+' : ''}${item.manualAdjustmentMinutes}분)`
        : '';
    rows.push({ label: '후기 결과', value: `${resultLabel(item.result)}${suffix}` });
  } else if (item.survey) {
    rows.push(
      { label: '자세', value: RATING_LABEL[item.survey.posture] },
      { label: '소음', value: RATING_LABEL[item.survey.noise] },
      { label: '빛 차단', value: RATING_LABEL[item.survey.light] },
      { label: '만족도', value: RATING_LABEL[item.survey.satisfaction] }
    );
  } else if (item.survey === null) {
    rows.push({ label: '설문', value: '건너뜀' });
  }

  if (item.manualAdjust) {
    const sourceLabel = item.manualAdjust.source === 'settings' ? '설정에서 조정' : '직접 조정';
    rows.push({
      label: '수동 조정',
      value: `${sourceLabel} (${item.manualAdjust.beforeMinutes}→${item.manualAdjust.afterMinutes}분)`,
    });
  }

  if (item.memo) {
    rows.push({ label: '메모', value: item.memo });
  }

  if (item.wakeChecklist) {
    rows.push({ label: '기상 루틴', value: wakeChecklistSummary(item.wakeChecklist) });
  }

  return rows;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<NapRecord[]>([]);
  // 한 번에 하나만 펼친다(아코디언) — completedAt이 유니크 키.
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    getNapRecords().then((r) => setRecords([...r].reverse()));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>낮잠 기록</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <Text style={styles.emptyText}>아직 기록된 낮잠이 없어요.</Text>
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
                accessibilityLabel="낮잠 기록 상세 보기"
                accessibilityState={{ expanded: isExpanded }}
              >
                <View style={styles.rowHead}>
                  <Text style={styles.rowDate}>{formatKoreanDateTime(new Date(item.completedAt))}</Text>
                  {item.isTest && (
                    <View style={styles.testBadge}>
                      <Text style={styles.testBadgeText}>테스트</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowDetail}>
                  {modeName(item.mode)} · <Text style={tabularNums}>{item.offsetMinutes}분</Text> ·{' '}
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
