// 기상 루틴 3화면(/wake-stretch → /wake-light → /wake-water → /feedback)의 공통 구현 —
// app/wake-stretch.tsx 등은 이 컴포넌트를 stage만 바꿔 얇게 감싼다(expo-router는 파일
// 하나당 라우트 하나라 래퍼 자체는 못 없앤다). 알람/미션 해제 직후, ActiveNap이 이미
// 지워지고 PendingFeedback으로 넘어간 뒤에만 진입한다 — 그래서 useNapWatchdog을 쓰지
// 않는다(app/feedback.tsx와 동일한 이유: watchdog은 ActiveNap 기준 라우팅이라 이 시점엔
// nap=null이 되어 즉시 홈으로 오판한다). 대신 feedback.tsx와 같은 자체 가드
// (getPendingFeedback() 없으면 홈으로)를 쓴다.
import { useEffect, useRef } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { SlideToConfirm } from './SlideToConfirm';
import { appendNapRecord, clearPendingFeedback, getPendingFeedback, markWakeChecklistItem, type WakeChecklist } from './store';
import { colors, fontFamily } from './theme';

export type WakeStage = keyof WakeChecklist;

const NEXT_ROUTE: Record<WakeStage, '/wake-light' | '/wake-water' | '/feedback'> = {
  stretch: '/wake-light',
  light: '/wake-water',
  water: '/feedback',
};

export function WakeRoutineScreen({ stage }: { stage: WakeStage }) {
  const router = useRouter();
  const { t } = useTranslation('wakeRoutine');
  const advancedRef = useRef(false);

  // 알람/미션 화면과 동일하게 하드웨어 뒤로가기를 막는다 — 건너뛰기 없음.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  // 대기 중인 후기가 없다(직접 진입 등 예외 상황) — app/feedback.tsx와 동일한 가드로 홈으로.
  useEffect(() => {
    getPendingFeedback().then((pending) => {
      if (!pending) router.replace('/');
    });
  }, [router]);

  const onConfirm = async () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markWakeChecklistItem(stage);

    // 테스트 낮잠은 water 화면에서 끝낸다 — /feedback의 "직접 조정하기"는 학습값을
    // 직접 바꾸는 유일한 경로라 테스트 낮잠이 거기 도달하면 안 된다(CLAUDE.md 지뢰 목록,
    // src/finishNap.ts의 resolveFinishNapDestination 주석 참고).
    if (stage === 'water') {
      const pending = await getPendingFeedback();
      if (pending?.isTest) {
        await appendNapRecord({
          completedAt: Date.now(),
          mode: pending.mode,
          offsetMinutes: pending.offsetMinutes,
          result: 'test',
          isTest: true,
          wakeChecklist: pending.wakeChecklist,
        });
        await clearPendingFeedback();
        router.replace('/');
        return;
      }
    }

    router.replace(NEXT_ROUTE[stage]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.instruction}>{t(`${stage}.instruction`)}</Text>
        <Text style={styles.effect}>{t(`${stage}.effect`)}</Text>
      </View>

      <SlideToConfirm
        label={t(`${stage}.slideLabel`)}
        a11yLabel={t('a11ySlideLabel')}
        a11yActionLabel={t('a11yDismissAction')}
        onConfirm={onConfirm}
      />
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  instruction: {
    fontSize: 28,
    fontFamily: fontFamily.heavy,
    letterSpacing: -0.84,
    color: colors.surface,
    textAlign: 'center',
  },
  effect: {
    fontSize: 15,
    lineHeight: 23,
    fontFamily: fontFamily.regular,
    color: colors.onDarkMuted,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
