import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  canRunAnalysis,
  filterAnalyzableRecords,
  getNapRecords,
  MIN_RECORDS_FOR_ANALYSIS,
  periodSinceMs,
  type AnalysisPeriod,
  type NapRecord,
} from '@/store';
import { colors, fontFamily, radius } from '@/theme';

const PERIODS: { value: AnalysisPeriod; label: string }[] = [
  { value: '1w', label: '최근 1주' },
  { value: '2w', label: '최근 2주' },
  { value: '1m', label: '최근 1개월' },
  { value: 'all', label: '전체' },
];

export default function AnalysisPeriodScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<NapRecord[]>([]);
  const [period, setPeriod] = useState<AnalysisPeriod>('2w');

  useEffect(() => {
    getNapRecords().then(setRecords);
  }, []);

  const since = periodSinceMs(period, Date.now());
  const count = filterAnalyzableRecords(records, since).length;
  const canStart = canRunAnalysis(count);

  const onStart = () => {
    if (!canStart) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/analysis', params: { since: since === undefined ? '' : String(since) } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>AI 분석</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>어느 기간의 기록을 분석할까요?</Text>

      <View style={styles.chipRow}>
        {PERIODS.map((p) => {
          const selected = period === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPeriod(p.value);
              }}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityLabel={p.label}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.countText}>이 기간 기록 {count}개</Text>
      {!canStart && (
        <Text style={styles.countCaption}>
          이 기간엔 기록이 {MIN_RECORDS_FOR_ANALYSIS}개 미만이라 분석할 수 없어요. 다른 기간을 선택해보세요.
        </Text>
      )}

      <Pressable
        onPress={onStart}
        disabled={!canStart}
        style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
      >
        <Text style={[styles.startBtnText, !canStart && styles.startBtnTextDisabled]}>분석하기</Text>
      </Pressable>
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
  subtitle: {
    marginTop: 24,
    fontSize: 15,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  chipRow: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.surface,
  },
  countText: {
    marginTop: 24,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  countCaption: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
  startBtn: {
    marginTop: 'auto',
    minHeight: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnDisabled: {
    backgroundColor: colors.bg,
  },
  startBtnText: {
    fontSize: 17,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.34,
    color: colors.surface,
  },
  startBtnTextDisabled: {
    color: colors.inkFaint,
  },
});
