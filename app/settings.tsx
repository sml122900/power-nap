import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { getCreditBalance, isAnalysisError, requestDataDeletion } from '@/aiAnalysis';
import { PRIVACY_POLICY_URL } from '@/config';
import {
  getLanguagePreference,
  setLanguagePreference,
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
} from '@/i18n';
import { clearAiLocalData, getAiConsent, getSettings, setAiConsent, setMissionEnabled, setWakeRoutineEnabled, type Settings } from '@/store';
import { fontFamily, radius, type ThemeColors } from '@/theme';
import { useThemeColors, useThemeScheme, type ThemePreference } from '@/ThemeContext';

const LANGUAGE_PREFERENCES: LanguagePreference[] = ['system', ...SUPPORTED_LANGUAGES];
const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

// 설정 화면은 동작(behavior) 토글·계정 관리만 다룬다 — 낮잠 타이밍 조정/명언 수정/
// 구매 복원은 마이페이지(/mypage)로 이동했다(사용자 지시로 "허브"/"동작" 역할 분리).
export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation('settings');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { preference: themePref, setPreference: setThemePref } = useThemeScheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [aiConsent, setAiConsentState] = useState<boolean | null>(null);
  const [languagePref, setLanguagePref] = useState<LanguagePreference | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    getAiConsent().then(setAiConsentState);
    getLanguagePreference().then(setLanguagePref);
  }, []);

  const onSelectLanguage = async (pref: LanguagePreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setLanguagePreference(pref);
    setLanguagePref(pref);
  };

  const onSelectTheme = (pref: ThemePreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setThemePref(pref);
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

  if (!settings) {
    return <View style={styles.container} />;
  }

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
          <Text style={styles.dataSectionLabel}>{t('themeSectionLabel')}</Text>
          <View style={styles.themeOptionList}>
            {THEME_PREFERENCES.map((pref) => {
              const selected = themePref === pref;
              return (
                <Pressable
                  key={pref}
                  onPress={() => onSelectTheme(pref)}
                  style={[styles.themeOptionRow, selected && styles.themeOptionRowSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={t(`themeOption.${pref}`)}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.themeOptionText, selected && styles.themeOptionTextSelected]}>
                    {t(`themeOption.${pref}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

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
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('deleteSectionLabel')}</Text>
          <Pressable onPress={onDeleteServerData} style={styles.deleteDataBtn}>
            <Text style={styles.deleteDataBtnText}>{t('deleteDataButton')}</Text>
          </Pressable>
        </View>

        <View style={styles.dataSection}>
          <Text style={styles.dataSectionLabel}>{t('legalSectionLabel')}</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>{t('privacyPolicyLink')}</Text>
          </Pressable>
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
    gap: 24,
    paddingBottom: 40,
  },
  dataSection: {
    gap: 8,
  },
  linkBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  linkBtnText: {
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
  themeOptionList: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOptionRow: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  themeOptionRowSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  themeOptionText: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  themeOptionTextSelected: {
    color: colors.surface,
  },
  });
