import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatKoreanDateTime } from '@/format';
import { getNapRecords, type NapMode, type NapRecord, type NapRecordResult } from '@/store';
import { colors, fontFamily, radius, tabularNums } from '@/theme';

function modeName(mode: NapMode): string {
  if (mode === 'fast') return '바로 잠듦';
  if (mode === 'slow') return '뒤척임';
  return '커피냅';
}

function resultLabel(result: NapRecordResult): string {
  switch (result) {
    case 'tooDeep':
      return '너무 깊게 잤어요';
    case 'justRight':
      return '딱 좋았어요';
    case 'notEnough':
      return '아직 부족해요';
    case 'manual':
      return '직접 조정';
    case 'test':
      return '테스트';
  }
}

export default function HistoryScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<NapRecord[]>([]);

  useEffect(() => {
    getNapRecords().then((r) => setRecords([...r].reverse()));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>낮잠 기록</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      {records.length === 0 ? (
        <Text style={styles.emptyText}>아직 기록된 낮잠이 없어요.</Text>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.completedAt)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowHead}>
                <Text style={styles.rowDate}>{formatKoreanDateTime(new Date(item.completedAt))}</Text>
                {item.isTest && (
                  <View style={styles.testBadge}>
                    <Text style={styles.testBadgeText}>테스트</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rowDetail}>
                {modeName(item.mode)} · <Text style={tabularNums}>{item.offsetMinutes}분</Text> ·{' '}
                {resultLabel(item.result)}
                {item.result === 'manual' && item.manualAdjustmentMinutes !== undefined && (
                  <Text style={tabularNums}>
                    {' '}
                    ({item.manualAdjustmentMinutes > 0 ? '+' : ''}
                    {item.manualAdjustmentMinutes}분)
                  </Text>
                )}
              </Text>
            </View>
          )}
        />
      )}
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
  list: {
    marginTop: 24,
    gap: 10,
  },
  row: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDate: {
    fontSize: 13.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  testBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  testBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
  rowDetail: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
});
