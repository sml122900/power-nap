import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { configureAlarmAudioModeAsync } from '@/audio';
import { cancelAlarmNotificationAsync } from '@/notifications';
import { clearActiveNap, getActiveNap } from '@/store';
import { colors, fontFamily, radius } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const ALARM_SOUND = require('../assets/sounds/alarm.wav');
const HAPTICS_INTERVAL_MS = 1200;

export default function AlarmScreen() {
  const router = useRouter();
  useNapWatchdog('/alarm');

  const player = useAudioPlayer(ALARM_SOUND);
  const notificationIdRef = useRef<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    let hapticsInterval: ReturnType<typeof setInterval> | undefined;
    let stopped = false;

    (async () => {
      const nap = await getActiveNap();
      notificationIdRef.current = nap?.notificationId ?? null;
      if (stopped) return;

      await configureAlarmAudioModeAsync();
      if (stopped) return;

      player.loop = true;
      player.volume = 1.0;
      player.play();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      hapticsInterval = setInterval(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, HAPTICS_INTERVAL_MS);
    })();

    return () => {
      stopped = true;
      if (hapticsInterval) clearInterval(hapticsInterval);
      player.pause();
    };
  }, [player]);

  const onDismiss = async () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;

    player.pause();
    await cancelAlarmNotificationAsync(notificationIdRef.current);
    await clearActiveNap();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Text style={styles.title}>일어날 시간이에요</Text>
        <Text style={styles.subtitle}>
          5분 더 자면 수면 관성 때문에 더 멍해져요.{'\n'}지금 바로 일어나는 게 제일 개운합니다.
        </Text>
      </View>

      <Pressable onPress={onDismiss} style={({ pressed }) => [styles.wakeBtn, pressed && styles.wakeBtnPressed]}>
        <Text style={styles.wakeBtnText}>일어났어요</Text>
      </Pressable>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.9,
    color: colors.surface,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23.25,
    fontFamily: fontFamily.regular,
    color: colors.onDarkMuted,
    textAlign: 'center',
  },
  wakeBtn: {
    paddingVertical: 22,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  wakeBtnPressed: {
    transform: [{ scale: 0.985 }],
  },
  wakeBtnText: {
    fontSize: 18,
    fontFamily: fontFamily.heavy,
    color: colors.brand,
  },
});
