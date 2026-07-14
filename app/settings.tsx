import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { getCreditBalance, isAnalysisError, requestDataDeletion } from '@/aiAnalysis';
import { PRIVACY_POLICY_URL } from '@/config';
import { restorePurchases } from '@/purchases';
import {
  getLanguagePreference,
  setLanguagePreference,
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
} from '@/i18n';
import {
  appendNapRecord,
  applyManualAdjustment,
  CAFFEINE_ONSET_MAX,
  CAFFEINE_ONSET_MIN,
  clearAiLocalData,
  getAiConsent,
  getSettings,
  LATENCY_MAX,
  LATENCY_MIN,
  setAiConsent,
  setMissionEnabled,
  setWakeRoutineEnabled,
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

const LANGUAGE_PREFERENCES: LanguagePreference[] = ['system', ...SUPPORTED_LANGUAGES];

function valueFor(settings: Settings, mode: NapMode): number {
  return mode === 'coffee' ? settings.caffeineOnset : settings.latency[mode];
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation('settings');
  const [settings, setSettings] = useState<Settings | null>(null);
  // 입력창 원본 문자열 — 타이핑 중 clamp를 걸면 두 자리 수 입력이 불가능해진다
  // (feedback.tsx/index.tsx와 동일 패턴). 확정(blur/제출) 시에만 clamp해 저장한다.
  const [texts, setTexts] = useState<Record<NapMode, string>>({ fast: '', slow: '', coffee: '' });
  const [aiConsent, setAiConsentState] = useState<boolean | null>(null);
  const [languagePref, setLanguagePref] = useState<LanguagePreference | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setTexts({ fast: String(s.latency.fast), slow: String(s.latency.slow), coffee: String(s.caffeineOnset) });
    });
    getAiConsent().then(setAiConsentState);
    getLanguagePreference().then(setLanguagePref);
  }, []);

  const onSelectLanguage = async (pref: LanguagePreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguagePreference(pref);
    setLanguagePref(pref);
  };

  // AI_ANALYSIS.md §6 "동의 철회" — 히스토리 화면의 "AI 분석" 진입 시 동의 화면과 별개로
  // 여기서 직접 뒤집을 수 있다("재동의 가능").
  const onToggleAiConsent = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = aiConsent !== true;
    await setAiConsent(next);
    setAiConsentState(next);
  };

  // 알람 해제 미션 토글 — 기본 false(기존 사용자 경험 보호), 여기서만 켤 수 있다.
  const onToggleMission = async () => {
    if (!settings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !settings.missionEnabled;
    await setMissionEnabled(next);
    setSettings({ ...settings, missionEnabled: next });
  };

  // 기상 루틴(스트레치·빛·물) 토글 — 기본 true, 명언 미션과는 독립적으로 켜고 끈다.
  const onToggleWakeRoutine = async () => {
    if (!settings) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !settings.wakeRoutineEnabled;
    await setWakeRoutineEnabled(next);
    setSettings({ ...settings, wakeRoutineEnabled: next });
  };

  // "구매 복원" — AI_ANALYSIS.md §7 Phase D. 기기 변경/재설치 시 RevenueCat에 남아있는
  // 구매 이력을 현재 익명 uid에 다시 연결한다(크레딧 자체는 webhook이 이미 적립해둔 것을
  // 되찾는 게 아니라, RevenueCat 쪽 구매 기록을 동기화하는 절차 — 실제 크레딧 원장은
  // 항상 서버가 진실의 원천).
  const onRestorePurchases = async () => {
    if (restoring) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestoring(true);
    const outcome = await restorePurchases();
    setRestoring(false);
    if (outcome.status === 'success') {
      Alert.alert(t('restoreSuccessTitle'), t('restoreSuccessBody'));
    } else if (outcome.status === 'error') {
      Alert.alert(t('restoreErrorTitle'), outcome.message);
    }
  };

  // 개인정보처리방침 "서버 데이터 삭제" — 2단계 확인(안내 → 최종 확인) 후 실행.
  // Alert.alert만으로 구현(이 화면에 별도 모달/바텀시트 컴포넌트가 없어, 새로 만들지
  // 않고 OS 네이티브 확인창을 재사용 — 파괴적 동작이라 네이티브 확인창이 더 신뢰감을
  // 준다는 점도 있음).
  const onDeleteServerData = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const balance = await getCreditBalance();
    const body =
      balance && balance > 0
        ? `${t('deleteConfirmBody')}\n\n${t('deleteConfirmCreditWarning', { count: balance })}`
        : t('deleteConfirmBody');

    Alert.alert(t('deleteConfirmTitle'), body, [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('deleteConfirmContinue'), onPress: confirmDeleteServerData },
    ]);
  };

  const confirmDeleteServerData = () => {
    Alert.alert(t('deleteFinalTitle'), t('deleteFinalBody'), [
      { text: t('common:cancel'), style: 'cancel' },
      { text: t('deleteFinalConfirm'), style: 'destructive', onPress: performDeleteServerData },
    ]);
  };

  const performDeleteServerData = async () => {
    try {
      await requestDataDeletion();
      await clearAiLocalData();
      setAiConsentState(false);
      Alert.alert(t('deleteSuccessTitle'), t('deleteSuccessBody'));
    } catch (err) {
      const message = isAnalysisError(err) ? err.message : t('analysisReport:unknownError');
      Alert.alert(t('deleteErrorTitle'), message);
    }
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
        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('missionSectionLabel')}</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataRowText}>
              {settings.missionEnabled ? t('missionOnDescription') : t('missionOffDescription')}
            </Text>
            <Pressable onPress={onToggleMission} style={styles.dataToggleBtn}>
              <Text style={styles.dataToggleBtnText}>
                {settings.missionEnabled ? t('missionToggleOff') : t('missionToggleOn')}
              </Text>
            </Pressable>
          </View>

          {settings.missionEnabled && (
            <Pressable onPress={() => router.push('/mission-quotes')} style={styles.missionQuotesLinkBtn}>
              <Text style={styles.missionQuotesLinkBtnText}>{t('missionQuotesLink')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('wakeRoutineSectionLabel')}</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataRowText}>
              {settings.wakeRoutineEnabled ? t('wakeRoutineOnDescription') : t('wakeRoutineOffDescription')}
            </Text>
            <Pressable onPress={onToggleWakeRoutine} style={styles.dataToggleBtn}>
              <Text style={styles.dataToggleBtnText}>
                {settings.wakeRoutineEnabled ? t('wakeRoutineToggleOff') : t('wakeRoutineToggleOn')}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.list}>
          <Text style={styles.dataSectionLabel}>{t('napTimingSectionLabel')}</Text>
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

        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('languageSectionLabel')}</Text>
          <View style={styles.languageOptionList}>
            {LANGUAGE_PREFERENCES.map((pref) => {
              const selected = languagePref === pref;
              return (
                <Pressable
                  key={pref}
                  onPress={() => onSelectLanguage(pref)}
                  style={[styles.languageOptionRow, selected && styles.languageOptionRowSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={t(`languageOption.${pref}`)}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.languageOptionText, selected && styles.languageOptionTextSelected]}>
                    {t(`languageOption.${pref}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('dataSectionLabel')}</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataRowText}>
              {aiConsent === true ? t('consentGranted') : t('consentNotGranted')}
            </Text>
            <Pressable onPress={onToggleAiConsent} style={styles.dataToggleBtn}>
              <Text style={styles.dataToggleBtnText}>
                {aiConsent === true ? t('consentToggleRevoke') : t('consentToggleGrant')}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={onRestorePurchases} disabled={restoring} style={styles.missionQuotesLinkBtn}>
            <Text style={styles.missionQuotesLinkBtnText}>
              {restoring ? t('restoringPurchases') : t('restorePurchasesButton')}
            </Text>
          </Pressable>
          <Pressable onPress={onDeleteServerData} style={styles.deleteDataBtn}>
            <Text style={styles.deleteDataBtnText}>{t('deleteDataButton')}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} style={styles.missionQuotesLinkBtn}>
            <Text style={styles.missionQuotesLinkBtnText}>{t('privacyPolicyLink')}</Text>
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
  dataSection: {
    gap: 8,
  },
  missionQuotesLinkBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  missionQuotesLinkBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
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
  deleteDataBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  deleteDataBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  languageOptionList: {
    flexDirection: 'row',
    gap: 8,
  },
  languageOptionRow: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  languageOptionRowSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  languageOptionText: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  languageOptionTextSelected: {
    color: colors.surface,
  },
});
