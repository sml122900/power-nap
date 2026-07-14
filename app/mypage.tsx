// 마이페이지(허브) — 홈 화면 "마이페이지" 링크로 진입. 계정/데이터 열람 액션을 한 곳에
// 모은다(사용자 지시로 설정 화면에서 분리 — 설정은 이제 동작 토글만 다룬다). 낮잠 타이밍
// 조정 스테퍼는 원래 설정 화면에 있던 걸 그대로 옮겨왔다("수면설정시간 조정 — 설정에서
// 이동").
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { getCreditBalance } from '@/aiAnalysis';
import {
  appendNapRecord,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  getAiConsent,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  TARGET_SLEEP_MIN,
  type NapMode,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

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

export default function MyPageScreen() {
  const router = useRouter();
  const { t } = useTranslation('mypage');
  const [settings, setSettings] = useState<Settings | null>(null);
  // 입력창 원본 문자열 — 타이핑 중 clamp를 걸면 두 자리 수 입력이 불가능해진다
  // (feedback.tsx/settings.tsx와 동일 패턴). 확정(blur/제출) 시에만 clamp해 저장한다.
  const [texts, setTexts] = useState<Record<NapMode, string>>({ fast: '', slow: '', coffee: '' });
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);
  // null = 아직 조회 전(또는 미동의라 조회 자체를 안 함), number = 조회된 잔량.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTexts({ fast: String(s.latency.fast), slow: String(s.latency.slow), coffee: String(s.caffeineOnset) });
    });
    // 동의 전에는 서버로 아무것도 안 보낸다는 원칙(history.tsx와 동일) — 동의 확인 후에만
    // getCreditBalance()를 호출한다.
    getAiConsent().then((consent) => {
      setAiConsent(consent);
      if (consent === true) getCreditBalance().then(setCreditBalance);
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
        <View style={styles.creditBox}>
          <Text style={styles.creditText}>
            {aiConsent === true ? t('creditBalance', { count: creditBalance ?? 0 }) : t('creditBalanceConsentNotice')}
          </Text>
        </View>

        <View style={styles.list}>
          <Text style={styles.sectionLabel}>{t('sleepTimingSectionLabel')}</Text>
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

        <View style={styles.navList}>
          <Pressable onPress={() => router.push('/history')} style={styles.navRow}>
            <Text style={styles.navRowText}>{t('napHistoryLink')}</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/analysis-history')} style={styles.navRow}>
            <Text style={styles.navRowText}>{t('aiAnalysisHistoryLink')}</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/purchase-history')} style={styles.navRow}>
            <Text style={styles.navRowText}>{t('purchaseHistoryLink')}</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/mission-quotes')} style={styles.navRow}>
            <Text style={styles.navRowText}>{t('missionQuotesLink')}</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    gap: 24,
    paddingBottom: 40,
  },
  creditBox: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.bg,
  },
  creditText: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
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
  navList: {
    gap: 10,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  navRowText: {
    fontSize: 14.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  navRowChevron: {
    fontSize: 18,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
});
