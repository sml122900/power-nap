// 알람 해제 미션(명언 타이핑) — 설정의 "알람 해제 미션" 토글이 켜져 있을 때, 알람
// 화면(/alarm)의 슬라이드/롱프레스 해제 다음에 이 화면을 거친다(뒷단: 기상 체크리스트 →
// 설문은 그대로). 알람음/진동은 슬라이드 이후에도 이 화면까지 계속 울린다 — 실제 정지·
// 알림 취소·기록 저장은 명언 통과 시점(finishNap)에 한 번에 처리한다. BACKLOG.md
// "알람 해제 미션" 참고.
import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { finishNap } from '@/finishNap';
import i18n from '@/i18n';
import { ESCAPE_PHRASE, getMissionQuotes, pickRandomQuote, resolveMissionAttempt, type MissionQuote } from '@/missionQuotes';
import { getActiveNap, getSettings, type ActiveNap } from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useAlarmPlayback } from '@/useAlarmPlayback';
import { useNapWatchdog } from '@/useNapWatchdog';

const ALARM_SOUND = require('../assets/sounds/alarm.wav');
// 현재 명언에서 연속 실패 횟수가 이 값에 도달하면 명언 대신 고정 탈출 문구
// (ESCAPE_PHRASE)를 요구한다 — 더 이상의 폴백은 없다(이 문구도 틀리면 계속 재시도).
const MAX_ATTEMPTS_BEFORE_ESCAPE = 3;

export default function MissionScreen() {
  const router = useRouter();
  const { t } = useTranslation('mission');
  useNapWatchdog('/mission');

  const player = useAudioPlayer(ALARM_SOUND);
  useAlarmPlayback(player);

  const locale = i18n.language === 'ko' ? 'ko' : 'en';
  const [nap, setNap] = useState<ActiveNap | null>(null);
  // finishNap의 목적지 판정(wake-sequence 브랜치)에 그대로 전달한다.
  const [wakeRoutineEnabled, setWakeRoutineEnabled] = useState(true);
  const [quotes, setQuotes] = useState<MissionQuote[] | null>(null);
  const [quote, setQuote] = useState<MissionQuote | null>(null);
  const [input, setInput] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [escapeMode, setEscapeMode] = useState(false);
  const [showRetryHint, setShowRetryHint] = useState(false);
  const dismissedRef = useRef(false);
  const escapePhrase = ESCAPE_PHRASE[locale];

  // 미션 화면도 알람 화면과 동일하게 하드웨어 뒤로가기를 막는다(§6.3) — 건너뛰기 없음.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let stopped = false;
    (async () => {
      const [loadedNap, settings, loadedQuotes] = await Promise.all([
        getActiveNap(),
        getSettings(),
        getMissionQuotes(locale),
      ]);
      if (stopped) return;
      setNap(loadedNap);
      setWakeRoutineEnabled(settings.wakeRoutineEnabled);
      setQuotes(loadedQuotes);
      setQuote(pickRandomQuote(loadedQuotes));
    })();
    return () => {
      stopped = true;
    };
  }, []);

  const onSubmit = async () => {
    if (dismissedRef.current || !quotes || !quote) return;

    const { passed, nextState } = resolveMissionAttempt(
      input,
      quote,
      escapePhrase,
      { failCount, escapeMode },
      MAX_ATTEMPTS_BEFORE_ESCAPE
    );

    if (passed) {
      dismissedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const active = nap ?? (await getActiveNap());
      const destination = await finishNap(player, active, wakeRoutineEnabled);
      router.replace(destination);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setInput('');
    setShowRetryHint(true);
    setFailCount(nextState.failCount);
    setEscapeMode(nextState.escapeMode);
  };

  if (!quotes || !quote) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.container} edges={['top', 'bottom']} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.instruction}>{t('instruction')}</Text>

          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{escapeMode ? escapePhrase : quote.text}</Text>
            {!escapeMode && quote.author ? (
              <Text style={styles.quoteAuthor}>{t('quoteAuthor', { author: quote.author })}</Text>
            ) : null}
          </View>

          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={onSubmit}
            placeholder={t('inputPlaceholder')}
            placeholderTextColor={colors.inkFaint}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel={t('a11yInput')}
          />

          {showRetryHint && <Text style={styles.retryHint}>{t('retryHint')}</Text>}
          {escapeMode && <Text style={styles.escapeNotice}>{t('escapeNotice', { phrase: escapePhrase })}</Text>}
        </View>

        <Pressable onPress={onSubmit} style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}>
          <Text style={styles.submitBtnText}>{t('submitButton')}</Text>
        </Pressable>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  flex: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.6,
    color: colors.surface,
    textAlign: 'center',
  },
  instruction: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.onDarkMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  quoteCard: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  quoteText: {
    fontSize: 20,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    textAlign: 'center',
  },
  quoteAuthor: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  input: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 16,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  retryHint: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.amber,
    textAlign: 'center',
  },
  escapeNotice: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.onDarkMuted,
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: 20,
    paddingVertical: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  submitBtnPressed: {
    backgroundColor: colors.brandTint,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: fontFamily.bold,
    color: colors.brand,
  },
});
