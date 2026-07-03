import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { addMinutes, formatKoreanTime } from '@/format';
import { scheduleAlarmNotificationAsync } from '@/notifications';
import { getSettings, saveActiveNap, type ActiveNap, type NapMode, type Settings } from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const DEFAULT_OFFSETS: Settings['offsets'] = { fast: 20, slow: 30 };

export default function HomeScreen() {
  const router = useRouter();
  useNapWatchdog('/');

  const [now, setNow] = useState(() => new Date());
  const [offsets, setOffsets] = useState<Settings['offsets']>(DEFAULT_OFFSETS);
  const startingRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    getSettings().then((settings) => setOffsets(settings.offsets));
  }, []);

  const startNap = async (mode: NapMode) => {
    if (startingRef.current) return;
    startingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const startedAt = Date.now();
      const alarmAt = startedAt + offsets[mode] * 60_000;
      // 알림 권한 요청은 여기(첫 낮잠 시작 시점)에서만 이루어진다 — 거부돼도 낮잠은 진행한다.
      const notificationId = await scheduleAlarmNotificationAsync(alarmAt);
      const nap: ActiveNap = { mode, startedAt, alarmAt, coffee: false, notificationId };
      await saveActiveNap(nap);
      router.replace('/sleep');
    } finally {
      startingRef.current = false;
    }
  };

  const fastAlarmAt = addMinutes(now, offsets.fast);
  const slowAlarmAt = addMinutes(now, offsets.slow);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topRow}>
        <Text style={styles.nowLabel}>지금</Text>
        <Text style={[styles.nowTime, tabularNums]}>{formatKoreanTime(now)}</Text>
      </View>

      <View style={styles.head}>
        <Text style={styles.title}>졸리면{'\n'}그냥 누르세요</Text>
        <Text style={styles.subtitle}>계산은 앱이 할게요. 딱 맞는 시간에 깨워드려요.</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => startNap('fast')}
          style={({ pressed }) => [styles.napBtn, styles.primary, pressed && styles.primaryPressed]}
        >
          <Text style={styles.primaryMode}>바로 잠들 것 같아요</Text>
          <Text style={[styles.primaryDetail, tabularNums]}>
            {offsets.fast}분 뒤 · {formatKoreanTime(fastAlarmAt)} 알람
          </Text>
        </Pressable>

        <Pressable
          onPress={() => startNap('slow')}
          style={({ pressed }) => [styles.napBtn, styles.secondary, pressed && styles.secondaryPressed]}
        >
          <Text style={styles.secondaryMode}>좀 뒤척일 것 같아요</Text>
          <Text style={[styles.secondaryDetail, tabularNums]}>
            {offsets.slow}분 뒤 · {formatKoreanTime(slowAlarmAt)} 알람
          </Text>
        </Pressable>

        <Text style={styles.learnNote}>
          후기를 반영해 시간이 자동으로 조정돼요{'\n'}
          <Text style={styles.learnNoteBold}>
            학습된 시간 — 바로 잠듦 {offsets.fast}분 · 뒤척임 {offsets.slow}분
          </Text>
        </Text>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  nowLabel: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  nowTime: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.inkSoft,
  },
  head: {
    marginTop: 44,
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.84,
    lineHeight: 35,
    color: colors.ink,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22.5,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  buttons: {
    marginTop: 36,
    flex: 1,
    gap: 12,
  },
  napBtn: {
    borderRadius: radius.lg,
    paddingHorizontal: 24,
    paddingVertical: 26,
    minHeight: 128,
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  primaryPressed: {
    backgroundColor: colors.brandPress,
  },
  primaryMode: {
    fontSize: 20,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.4,
    color: colors.surface,
  },
  primaryDetail: {
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    color: colors.onDarkFaint,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  secondaryPressed: {
    backgroundColor: colors.bg,
  },
  secondaryMode: {
    fontSize: 20,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  secondaryDetail: {
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  learnNote: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 12.5,
    lineHeight: 18.75,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
  learnNoteBold: {
    fontFamily: fontFamily.bold,
    color: colors.inkSoft,
  },
});
