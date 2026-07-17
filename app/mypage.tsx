// 마이페이지(허브) — 홈 화면 "마이페이지" 링크로 진입. 계정/데이터 열람 액션을 한 곳에
// 모은다(사용자 지시로 설정 화면에서 분리 — 설정은 이제 동작 토글만 다룬다). 알람 시간
// 조정 스테퍼는 세로 공간을 너무 많이 차지해 별도 화면(/alarm-timing)으로 분리했다
// (사용자 지시) — 여기서는 진입 링크 한 줄만 남는다.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { getCreditBalance } from '@/aiAnalysis';
import { purchaseExtraAnalysis } from '@/purchases';
import { getAiConsent } from '@/store';
import { colors, fontFamily, radius } from '@/theme';

export default function MyPageScreen() {
  const router = useRouter();
  const { t } = useTranslation('mypage');
  const [aiConsent, setAiConsent] = useState<boolean | null>(null);
  // null = 아직 조회 전(또는 미동의라 조회 자체를 안 함), number = 조회된 잔량.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasePending, setPurchasePending] = useState(false);

  useEffect(() => {
    // 동의 전에는 서버로 아무것도 안 보낸다는 원칙(history.tsx와 동일) — 동의 확인 후에만
    // getCreditBalance()를 호출한다.
    getAiConsent().then((consent) => {
      setAiConsent(consent);
      if (consent === true) getCreditBalance().then(setCreditBalance);
    });
  }, []);

  // 이용권 구매 — 기존엔 402(무료 소진) 화면에서만 가능했는데, 잔량 옆에 바로 사는 게
  // 더 직관적이라는 사용자 지시로 추가(app/analysis.tsx의 onPurchase와 동일 패턴).
  // 실제 크레딧 적립은 RevenueCat webhook 경유라 구매 성공 직후엔 반영 전일 수 있어
  // 잠깐 폴링한다.
  const onPurchase = async () => {
    if (purchasing || purchasePending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasing(true);
    const outcome = await purchaseExtraAnalysis();
    setPurchasing(false);

    if (outcome.status === 'error') {
      Alert.alert(t('analysisReport:purchaseErrorTitle'), outcome.message);
      return;
    }
    if (outcome.status === 'cancelled') return;

    setPurchasePending(true);
    const beforeBalance = creditBalance ?? 0;
    let updatedBalance: number | null = null;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const balance = await getCreditBalance();
      if (balance !== null && balance > beforeBalance) {
        updatedBalance = balance;
        break;
      }
    }
    setPurchasePending(false);
    if (updatedBalance !== null) {
      setCreditBalance(updatedBalance);
    } else {
      Alert.alert(t('analysisReport:purchaseErrorTitle'), t('analysisReport:purchaseTimeoutMessage'));
    }
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
          {aiConsent === true &&
            (purchasePending ? (
              <ActivityIndicator color={colors.inkFaint} />
            ) : (
              <Pressable
                onPress={onPurchase}
                disabled={purchasing}
                style={[styles.purchaseBtn, purchasing && styles.purchaseBtnDisabled]}
              >
                <Text style={styles.purchaseBtnText}>
                  {purchasing ? t('analysisReport:purchasing') : t('analysisReport:purchaseButton')}
                </Text>
              </Pressable>
            ))}
        </View>

        <Text style={styles.deviceNotice}>{t('deviceDataNotice')}</Text>

        <View style={styles.navList}>
          <Pressable onPress={() => router.push('/alarm-timing')} style={styles.navRow}>
            <Text style={styles.navRowText}>{t('alarmTimingLink')}</Text>
            <Text style={styles.navRowChevron}>›</Text>
          </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: colors.bg,
  },
  creditText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  purchaseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
  },
  purchaseBtnDisabled: {
    opacity: 0.6,
  },
  purchaseBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.surface,
  },
  deviceNotice: {
    fontSize: 12.5,
    lineHeight: 18.75,
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
