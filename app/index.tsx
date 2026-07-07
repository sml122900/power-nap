import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { SHOW_TEST_BUTTONS } from '@/config';
import { addMinutes, formatKoreanTime } from '@/format';
import { scheduleAlarmNotificationAsync } from '@/notifications';
import {
  computeCoffeeAlarmAt,
  getSettings,
  saveActiveNap,
  TARGET_SLEEP_MIN,
  type ActiveNap,
  type Settings,
} from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';
import { useNapWatchdog } from '@/useNapWatchdog';

const DEFAULT_LATENCY: Settings['latency'] = { fast: 0, slow: 10 };
const DEFAULT_CAFFEINE_ONSET = 25;
const TOAST_DURATION_MS = 3200;
const COFFEE_MINUTES_AGO_MAX = 120;
const CHIP_ANIM_MS = 150;

export default function HomeScreen() {
  const router = useRouter();
  useNapWatchdog('/');
  const { toast } = useLocalSearchParams<{ toast?: string }>();

  const [now, setNow] = useState(() => new Date());
  const [latency, setLatency] = useState<Settings['latency']>(DEFAULT_LATENCY);
  const [caffeineOnset, setCaffeineOnset] = useState(DEFAULT_CAFFEINE_ONSET);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startingRef = useRef(false);
  // 후기 화면에서 넘어온 토스트 문구는 마운트 시점 값만 캡처한다 — 이후 같은 화면에
  // 머무는 동안 라우터 파라미터가 남아있어도 다시 뜨지 않는다.
  const [toastMessage, setToastMessage] = useState<string | null>(() => toast ?? null);

  const [coffeeOpen, setCoffeeOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  // 입력창 원본 문자열 — 확정(blur/시작 버튼) 시에만 clamp한다(feedback.tsx와 동일 패턴).
  const [minutesAgoText, setMinutesAgoText] = useState('0');
  const scrollRef = useRef<ScrollView>(null);

  // 커피냅 칩/직접입력 패널이 펼쳐지면 새로 드러난 영역(칩 그리드 또는 미리보기+확정 버튼)이
  // 화면 아래로 잘릴 수 있어 자동으로 스크롤해 보여준다. 패널이 버튼 목록 맨 아래쪽이라
  // scrollToEnd로 충분하다 — 레이아웃이 반영될 시간을 주기 위해 한 틱 미룬다.
  useEffect(() => {
    if (!coffeeOpen) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [coffeeOpen, customOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // 설정 화면에서 값을 바꾸고 뒤로가기(pop)로 돌아왔을 때도 최신값을 반영해야 한다 —
  // 그 화면은 replace가 아니라 push/pop이라 이 화면이 리마운트되지 않는다.
  useFocusEffect(
    useCallback(() => {
      getSettings().then((settings) => {
        setLatency(settings.latency);
        setCaffeineOnset(settings.caffeineOnset);
      });
    }, [])
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const id = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [toastMessage]);

  const startFastSlow = async (mode: 'fast' | 'slow', overrideMs?: number) => {
    if (startingRef.current) return;
    startingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const startedAt = Date.now();
      const durationMs = overrideMs ?? (TARGET_SLEEP_MIN + latency[mode]) * 60_000;
      const alarmAt = startedAt + durationMs;
      // 알림 권한 요청은 여기(첫 낮잠 시작 시점)에서만 이루어진다 — 거부돼도 낮잠은 진행한다.
      const notificationId = await scheduleAlarmNotificationAsync(alarmAt);
      const nap: ActiveNap = { mode, startedAt, alarmAt, notificationId, isTest: overrideMs !== undefined };
      await saveActiveNap(nap);
      router.replace('/sleep');
    } finally {
      startingRef.current = false;
    }
  };

  const startCoffeeNap = async (minutesAgo: number) => {
    if (startingRef.current) return;
    startingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const startedAt = Date.now();
      const coffeeDrankAt = startedAt - minutesAgo * 60_000;
      const { alarmAt } = computeCoffeeAlarmAt(coffeeDrankAt, caffeineOnset, startedAt);
      const notificationId = await scheduleAlarmNotificationAsync(alarmAt);
      const nap: ActiveNap = { mode: 'coffee', startedAt, alarmAt, coffeeDrankAt, notificationId };
      await saveActiveNap(nap);
      router.replace('/sleep');
    } finally {
      startingRef.current = false;
    }
  };

  const toggleCoffeeOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCoffeeOpen((open) => !open);
    setCustomOpen(false);
  };

  const openCustom = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinutesAgoText('0');
    setCustomOpen(true);
  };

  const commitMinutesAgoText = (): number => {
    const parsed = parseInt(minutesAgoText, 10);
    const clamped = Number.isNaN(parsed) ? 0 : Math.min(COFFEE_MINUTES_AGO_MAX, Math.max(0, parsed));
    setMinutesAgoText(String(clamped));
    return clamped;
  };

  const fastTotal = TARGET_SLEEP_MIN + latency.fast;
  const slowTotal = TARGET_SLEEP_MIN + latency.slow;
  const fastAlarmAt = addMinutes(now, fastTotal);
  const slowAlarmAt = addMinutes(now, slowTotal);

  const customMinutesAgo = Math.min(COFFEE_MINUTES_AGO_MAX, Math.max(0, parseInt(minutesAgoText, 10) || 0));
  const customPreview = computeCoffeeAlarmAt(now.getTime() - customMinutesAgo * 60_000, caffeineOnset, now.getTime());
  const customPreviewMinutes = Math.max(0, Math.round((customPreview.alarmAt - now.getTime()) / 60_000));

  const chipAnim = reduceMotion
    ? undefined
    : { entering: FadeIn.duration(CHIP_ANIM_MS), exiting: FadeOut.duration(CHIP_ANIM_MS) };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Text style={styles.nowLabel}>지금</Text>
            <Text style={[styles.nowTime, tabularNums]}>{formatKoreanTime(now)}</Text>
          </View>

          <View style={styles.topLinksRow}>
            <Pressable onPress={() => router.push('/history')} hitSlop={12}>
              <Text style={styles.historyLinkText}>지난 낮잠 기록</Text>
            </Pressable>
            <Text style={styles.topLinksSeparator}>·</Text>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Text style={styles.historyLinkText}>설정</Text>
            </Pressable>
          </View>

          <View style={styles.head}>
            <Text style={styles.title}>졸리면{'\n'}그냥 누르세요</Text>
            <Text style={styles.subtitle}>계산은 앱이 할게요. 딱 맞는 시간에 깨워드려요.</Text>
          </View>

          <View style={styles.buttons}>
            <Pressable
              onPress={() => startFastSlow('fast')}
              style={({ pressed }) => [styles.napBtn, styles.primary, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryMode}>바로 잠들 것 같아요</Text>
              <Text style={[styles.primaryDetail, tabularNums]}>
                {fastTotal}분 뒤 · {formatKoreanTime(fastAlarmAt)} 알람
              </Text>
            </Pressable>

            <Pressable
              onPress={() => startFastSlow('slow')}
              style={({ pressed }) => [styles.napBtn, styles.secondary, pressed && styles.secondaryPressed]}
            >
              <Text style={styles.secondaryMode}>좀 뒤척일 것 같아요</Text>
              <Text style={[styles.secondaryDetail, tabularNums]}>
                {slowTotal}분 뒤 · {formatKoreanTime(slowAlarmAt)} 알람
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleCoffeeOpen}
              style={({ pressed }) => [styles.napBtn, styles.coffeeBtn, (pressed || coffeeOpen) && styles.coffeeBtnActive]}
            >
              <Text style={styles.coffeeMode}>커피냅</Text>
              <Text style={[styles.coffeeDetail, tabularNums]}>커피 마시고 {caffeineOnset}분 뒤 기상</Text>
            </Pressable>

            {coffeeOpen && !customOpen && (
              <Animated.View style={styles.coffeeChipGrid} {...chipAnim}>
                <Pressable onPress={() => startCoffeeNap(0)} style={styles.coffeeChip}>
                  <Text style={styles.coffeeChipText}>방금</Text>
                </Pressable>
                <Pressable onPress={() => startCoffeeNap(5)} style={styles.coffeeChip}>
                  <Text style={styles.coffeeChipText}>5분 전</Text>
                </Pressable>
                <Pressable onPress={() => startCoffeeNap(10)} style={styles.coffeeChip}>
                  <Text style={styles.coffeeChipText}>10분 전</Text>
                </Pressable>
                <Pressable onPress={openCustom} style={styles.coffeeChip}>
                  <Text style={styles.coffeeChipText}>직접 입력</Text>
                </Pressable>
              </Animated.View>
            )}

            {coffeeOpen && customOpen && (
              <Animated.View style={styles.coffeeCustomPanel} {...chipAnim}>
                <View style={styles.coffeeCustomInputRow}>
                  <TextInput
                    style={[styles.coffeeCustomInput, tabularNums]}
                    value={minutesAgoText}
                    onChangeText={(text) => setMinutesAgoText(text.replace(/[^0-9]/g, '').slice(0, 3))}
                    onBlur={commitMinutesAgoText}
                    onSubmitEditing={commitMinutesAgoText}
                    keyboardType="number-pad"
                    maxLength={3}
                    textAlign="center"
                    accessibilityLabel="몇 분 전에 커피를 마셨는지 입력 (0~120분)"
                  />
                  <Text style={styles.coffeeCustomUnit}>분 전</Text>
                </View>

                {customPreview.corrected && (
                  <Text style={styles.coffeeNotice}>카페인이 이미 돌고 있어요 — 최소 대기시간으로 맞출게요</Text>
                )}
                <Text style={[styles.coffeePreviewText, tabularNums]}>
                  {formatKoreanTime(new Date(customPreview.alarmAt))} 알람 ({customPreviewMinutes}분 뒤)
                </Text>

                <Pressable
                  onPress={() => startCoffeeNap(commitMinutesAgoText())}
                  style={({ pressed }) => [styles.coffeeConfirmBtn, pressed && styles.coffeeConfirmBtnPressed]}
                >
                  <Text style={styles.coffeeConfirmText}>이 시간으로 시작</Text>
                </Pressable>
              </Animated.View>
            )}

            <Text style={styles.learnNote}>
              후기를 반영해 시간이 자동으로 조정돼요{'\n'}
              <Text style={styles.learnNoteBold}>
                학습된 시간 — 바로 잠듦 {fastTotal}분 · 뒤척임 {slowTotal}분
              </Text>
            </Text>

            {/* 실기기 테스트용 단축 낮잠 버튼 — 노출 여부는 src/config.ts SHOW_TEST_BUTTONS로 관리 */}
            {SHOW_TEST_BUTTONS && (
              <View style={styles.devRow}>
                <Pressable onPress={() => startFastSlow('fast', 60_000)} style={styles.devBtn}>
                  <Text style={styles.devBtnText}>테스트: 1분 낮잠</Text>
                </Pressable>
                <Pressable onPress={() => startFastSlow('fast', 10_000)} style={styles.devBtn}>
                  <Text style={styles.devBtnText}>테스트: 10초</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {toastMessage && (
        <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
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
  topLinksRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  topLinksSeparator: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  historyLinkText: {
    fontSize: 13,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
    textDecorationLine: 'underline',
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
  // 커피냅 버튼 — fast/slow 두 버튼(128pt+ 핵심 결정)보다 낮은 위계를 위해 minHeight를
  // napBtn 공통값 대신 절반 정도로 줄인다. 색은 앱 유일 포인트 컬러(amber)만 사용.
  coffeeBtn: {
    minHeight: 64,
    backgroundColor: colors.amberTint,
    borderWidth: 1.5,
    borderColor: colors.amberBorder,
  },
  coffeeBtnActive: {
    backgroundColor: colors.amberPress,
  },
  coffeeMode: {
    fontSize: 17,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.34,
    color: colors.ink,
  },
  coffeeDetail: {
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  coffeeChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  // 칩 4개를 2x2로 배치해도 각 칩이 44pt 이상 확보되도록 flexBasis를 화면 폭 절반 기준으로.
  coffeeChip: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.amberBorder,
    backgroundColor: colors.surface,
    paddingVertical: 10,
  },
  coffeeChipText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  coffeeCustomPanel: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.amberBorder,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  coffeeCustomInputRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    gap: 6,
  },
  coffeeCustomInput: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: fontFamily.bold,
    color: colors.ink,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.line,
    paddingVertical: 2,
  },
  coffeeCustomUnit: {
    fontSize: 15,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  coffeeNotice: {
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: fontFamily.semibold,
    color: colors.amber,
  },
  coffeePreviewText: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.inkSoft,
  },
  coffeeConfirmBtn: {
    marginTop: 4,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.amber,
  },
  coffeeConfirmBtnPressed: {
    backgroundColor: colors.amberPress,
  },
  coffeeConfirmText: {
    fontSize: 15,
    fontFamily: fontFamily.bold,
    color: colors.surface,
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
  devRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  devBtn: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  devBtnText: {
    fontSize: 12,
    fontFamily: fontFamily.semibold,
    color: colors.inkFaint,
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 32,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  toastText: {
    fontSize: 14.5,
    lineHeight: 21.75,
    fontFamily: fontFamily.semibold,
    color: colors.surface,
    textAlign: 'center',
  },
});
