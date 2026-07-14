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
import { useTranslation } from 'react-i18next';

import { finishNap } from '@/finishNap';
import i18n from '@/i18n';
import { getMissionQuotes, isMissionInputCorrect, pickRandomQuote, pickShorterQuote, type MissionQuote } from '@/missionQuotes';
import { getActiveNap, getSettings, type ActiveNap } from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useAlarmPlayback } from '@/useAlarmPlayback';
import { useNapWatchdog } from '@/useNapWatchdog';

const ALARM_SOUND = require('../assets/sounds/alarm.wav');
// "3회 실패 시 다른(더 짧은) 명언 제시" — 현재 문구에서 연속 실패 횟수가 이 값에
// 도달하면 더 짧은 문구로 바꾸고 실패 횟수를 초기화한다.
const MAX_ATTEMPTS_BEFORE_SWAP = 3;

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
  const [showRetryHint, setShowRetryHint] = useState(false);
  const [showSwapNotice, setShowSwapNotice] = useState(false);
  const dismissedRef = useRef(false);

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

    if (isMissionInputCorrect(input, quote)) {
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

    const nextFailCount = failCount + 1;
    if (nextFailCount >= MAX_ATTEMPTS_BEFORE_SWAP) {
      setQuote(pickShorterQuote(quotes, quote));
      setFailCount(0);
      setShowSwapNotice(true);
    } else {
      setFailCount(nextFailCount);
      setShowSwapNotice(false);
    }
  };

  if (!quotes || !quote) {
    return <SafeAreaView style={styles.container} edges={['top', 'bottom']} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('title')}</Text>
          <Text style={styles.instruction}>{t('instruction')}</Text>

          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{quote.text}</Text>
            {quote.author ? <Text style={styles.quoteAuthor}>{t('quoteAuthor', { author: quote.author })}</Text> : null}
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
          {showSwapNotice && <Text style={styles.swapNotice}>{t('quoteSwapped')}</Text>}
        </View>

        <Pressable onPress={onSubmit} style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}>
          <Text style={styles.submitBtnText}>{t('submitButton')}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  swapNotice: {
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
