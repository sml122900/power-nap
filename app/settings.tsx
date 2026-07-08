import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  appendNapRecord,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  getAiConsent,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  setAiConsent,
  TARGET_SLEEP_MIN,
  type NapMode,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

const STEP = 1;

type Row = { mode: NapMode; label: string; min: number; max: number };

const ROWS: Row[] = [
  { mode: 'fast', label: '수면 대기시간 — 바로 잠들 것 같아요', min: LATENCY_MIN, max: LATENCY_MAX },
  { mode: 'slow', label: '수면 대기시간 — 좀 뒤척일 것 같아요', min: LATENCY_MIN, max: LATENCY_MAX },
  { mode: 'coffee', label: '카페인 발현시간', min: CAFFEINE_ONSET_MIN, max: CAFFEINE_ONSET_MAX },
];

function valueFor(settings: Settings, mode: NapMode): number {
  return mode === 'coffee' ? settings.caffeineOnset : settings.latency[mode];
}

function previewFor(mode: NapMode, value: number): string {
  if (mode === 'coffee') return `커피 마시고 ${value}분 뒤 기상`;
  const label = mode === 'fast' ? '바로 잠들 것 같아요' : '좀 뒤척일 것 같아요';
  return `${label} = ${TARGET_SLEEP_MIN} + ${value} = 총 ${TARGET_SLEEP_MIN + value}분`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  // 입력창 원본 문자열 — 타이핑 중 clamp를 걸면 두 자리 수 입력이 불가능해진다
  // (feedback.tsx/index.tsx와 동일 패턴). 확정(blur/제출) 시에만 clamp해 저장한다.
  const [texts, setTexts] = useState<Record<NapMode, string>>({ fast: '', slow: '', coffee: '' });
  const [aiConsent, setAiConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTexts({ fast: String(s.latency.fast), slow: String(s.latency.slow), coffee: String(s.caffeineOnset) });
    });
    getAiConsent().then(setAiConsentState);
  }, []);

  // AI_ANALYSIS.md §6 "동의 철회" — 히스토리 화면의 "AI 분석" 진입 시 동의 화면과 별개로
  // 여기서 직접 뒤집을 수 있다("재동의 가능").
  const onToggleAiConsent = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = aiConsent !== true;
    await setAiConsent(next);
    setAiConsentState(next);
  };

  // 스테퍼/텍스트 확정 모두 이 경로로만 저장한다. NapRecord.manualAdjust.source를
  // 'settings'로 남겨 후기 화면의 "직접 조정하기"(source: 'feedback')와 구분한다 —
  // Phase 4-3부터 latency/caffeineOnset을 바꾸는 경로는 이 두 곳뿐이다(§5).
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>설정</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {ROWS.map((row) => {
          const value = valueFor(settings, row.mode);
          return (
            <View key={row.mode} style={styles.card}>
              <Text style={styles.label}>{row.label}</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  onPress={() => onStep(row, -STEP)}
                  style={styles.stepBtn}
                  accessibilityLabel={`${STEP}분 줄이기`}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </Pressable>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, tabularNums]}
                    value={texts[row.mode]}
                    onChangeText={(text) =>
                      setTexts((t) => ({ ...t, [row.mode]: text.replace(/[^0-9]/g, '').slice(0, 2) }))
                    }
                    onBlur={() => onCommitText(row)}
                    onSubmitEditing={() => onCommitText(row)}
                    keyboardType="number-pad"
                    maxLength={2}
                    textAlign="center"
                    accessibilityLabel={`${row.label} 분 직접 입력 (${row.min}~${row.max})`}
                  />
                  <Text style={styles.unit}>분</Text>
                </View>
                <Pressable
                  onPress={() => onStep(row, STEP)}
                  style={styles.stepBtn}
                  accessibilityLabel={`${STEP}분 늘리기`}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={[styles.preview, tabularNums]}>{previewFor(row.mode, value)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.dataSection}>
        <Text style={styles.dataSectionLabel}>데이터 및 분석</Text>
        <View style={styles.dataRow}>
          <Text style={styles.dataRowText}>
            {aiConsent === true ? 'AI 분석 서버 전송에 동의함' : 'AI 분석 서버 전송에 동의하지 않음'}
          </Text>
          <Pressable onPress={onToggleAiConsent} style={styles.dataToggleBtn}>
            <Text style={styles.dataToggleBtnText}>{aiConsent === true ? '철회' : '동의'}</Text>
          </Pressable>
        </View>
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
  list: {
    marginTop: 24,
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
  dataSection: {
    marginTop: 24,
    gap: 8,
  },
  dataSectionLabel: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  dataRowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  dataToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  dataToggleBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
});
