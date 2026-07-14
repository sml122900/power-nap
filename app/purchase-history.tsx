// 결제 내역 화면 — 마이페이지 "결제 내역" 진입점. AI_ANALYSIS.md §7 Phase D는 아직
// 미완료(Play Console DUNS 발급 대기)라 itemized 구매 목록을 서버에서 끌어오는 API가
// 없다 — 지금은 빈 상태 문구 + "구매 복원"(설정 화면에서 이동)만 제공한다. 실제 구매
// 목록 조회는 이 Phase가 끝난 뒤 별도 작업.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { restorePurchases } from '@/purchases';
import { colors, fontFamily, radius } from '@/theme';

export default function PurchaseHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation('purchaseHistory');
  const [restoring, setRestoring] = useState(false);

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>{t('common:close')}</Text>
        </Pressable>
      </View>

      <Text style={styles.emptyText}>{t('emptyText')}</Text>

      <Pressable onPress={onRestorePurchases} disabled={restoring} style={styles.restoreBtn}>
        <Text style={styles.restoreBtnText}>{restoring ? t('restoringPurchases') : t('restorePurchasesButton')}</Text>
      </Pressable>
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
  emptyText: {
    marginTop: 44,
    textAlign: 'center',
    fontSize: 14.5,
    fontFamily: fontFamily.regular,
    color: colors.inkFaint,
  },
  restoreBtn: {
    marginTop: 'auto',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  restoreBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
});
