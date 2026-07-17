// 알람 시간 조정 화면 — 마이페이지 "알람 시간 조정 >" 링크로 진입(사용자 지시로 분리,
// 마이페이지의 세로 공간을 너무 많이 차지하던 스테퍼 3행을 별도 화면으로 이동).
// 조정 로직·저장은 원래 마이페이지에 있던 것 그대로 옮겨왔다 — applyManualAdjustment가
// 여전히 latency/caffeineOnset을 바꾸는 유일한 경로라 홈 화면 알람 계산에 그대로 반영된다.
// mypage-polish 브랜치가 dark-mode 병합 이전에 만들어진 화면이라, 병합 후 다른 화면과
// 같은 반응형 테마 패턴(useThemeColors + createStyles)으로 맞췄다 — 정적 colors import를
// 그대로 뒀으면 이 화면만 다크모드에서도 항상 라이트 색으로 남는다.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import {
  appendNapRecord,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  TARGET_SLEEP_MIN,
  type NapMode,
  type Settings,
} from '@/store';
import { fontFamily, radius, tabularNums, type ThemeColors } from '@/theme';
import { useThemeColors } from '@/ThemeContext';

const STEP = 1;

type Row = { mode: NapMode; labelKey: string; min: number; max: number };

const ROWS: Row[] = [
  { mode: 'fast', labelKey: 'rowLabel.fast', min: LATENCY_MIN, max: LATENCY_MAX },
  { mode: 'slow', labelKey: 'rowLabel.slow', min: LATENCY_MIN, max: LATENCY_MAX },
  { mode: 'coffee', labelKey: 'rowLabel.coffee', min: CAFFEINE_ONSET_MIN, max: CAFFEINE_ONSET_MAX },
];

function valueFor(settings: Settings, mode: NapMode): number {
  return mode === 'coffee' ? settings.caffeineOnset : settings.latency[mode];
}

export default function AlarmTimingScreen() {
  const router = useRouter();
  const { t } = useTranslation('alarmTiming');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [settings, setSettings] = useState<Settings | null>(null);
  // 입력창 원본 문자열 — 타이핑 중 clamp를 걸면 두 자리 수 입력이 불가능해진다
  // (feedback.tsx/mypage.tsx와 동일 패턴). 확정(blur/제출) 시에만 clamp해 저장한다.
  const [texts, setTexts] = useState<Record<NapMode, string>>({ fast: '', slow: '', coffee: '' });

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTexts({ fast: String(s.latency.fast), slow: String(s.latency.slow), coffee: String(s.caffeineOnset) });
    });
  }, []);

  const commit = async (mode: NapMode, nextValue: number) => {
    const prevValue = settings ? valueFor(settings, mode) : nextValue;
    if (nextValue === prevValue) return;
    const updated = await applyManualAdjustment(mode, nextValue);
    const finalValue = valueFor(updated, mode);
    setSettings(updated);
    setTexts((t) => ({ ...t, [mode]: String(finalValue) }));
    await appendNapRecord({
      completedAt: Date.now(),
      mode,
      offsetMinutes: mode === 'coffee' ? finalValue : TARGET_SLEEP_MIN + finalValue,
      manualAdjust: { source: 'settings', beforeMinutes: prevValue, afterMinutes: finalValue },
    });
  };

  const onStep = (row: Row, delta: number) => {
    if (!settings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const current = valueFor(settings, row.mode);
    const next = Math.min(row.max, Math.max(row.min, current + delta));
    commit(row.mode, next);
  };

  const onCommitText = (row: Row) => {
    if (!settings) return;
    const parsed = parseInt(texts[row.mode], 10);
    const prev = valueFor(settings, row.mode);
    const next = Number.isNaN(parsed) ? prev : Math.min(row.max, Math.max(row.min, parsed));
    setTexts((t) => ({ ...t, [row.mode]: String(next) }));
    commit(row.mode, next);
  };

  if (!settings) {
    return <View style={styles.container} />;
  }

  const previewFor = (mode: NapMode, value: number): string => {
    if (mode === 'coffee') return t('previewCoffee', { value });
    const rowLabelKey = mode === 'fast' ? 'rowLabel.fast' : 'rowLabel.slow';
    return t('previewLatency', {
      label: t(rowLabelKey),
      target: TARGET_SLEEP_MIN,
      value,
      total: TARGET_SLEEP_MIN + value,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>{t('common:close')}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.list}>
          {ROWS.map((row) => {
            const value = valueFor(settings, row.mode);
            return (
              <View key={row.mode} style={styles.card}>
                <Text style={styles.label}>{t(row.labelKey)}</Text>
                <View style={styles.stepperRow}>
                  <Pressable
                    onPress={() => onStep(row, -STEP)}
                    style={styles.stepBtn}
                    accessibilityLabel={t('stepDecreaseA11y', { step: STEP })}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, tabularNums]}
                      value={texts[row.mode]}
                      onChangeText={(text) =>
                        setTexts((prev) => ({ ...prev, [row.mode]: text.replace(/[^0-9]/g, '').slice(0, 2) }))
                      }
                      onBlur={() => onCommitText(row)}
                      onSubmitEditing={() => onCommitText(row)}
                      keyboardType="number-pad"
                      maxLength={2}
                      textAlign="center"
                      accessibilityLabel={t('inputA11y', { label: t(row.labelKey), min: row.min, max: row.max })}
                    />
                    <Text style={styles.unit}>{t('unit')}</Text>
                  </View>
                  <Pressable
                    onPress={() => onStep(row, STEP)}
                    style={styles.stepBtn}
                    accessibilityLabel={t('stepIncreaseA11y', { step: STEP })}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
                <Text style={[styles.preview, tabularNums]}>{previewFor(row.mode, value)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 28,
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
  scrollContent: {
    marginTop: 24,
    paddingBottom: 40,
  },
  list: {
    gap: 12,
  },
  card: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  input: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: 2,
  },
  unit: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  preview: {
    textAlign: 'center',
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
});
