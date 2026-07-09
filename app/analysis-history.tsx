import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { listAnalyses } from '@/aiAnalysis';
import { formatAnalysisListLabels } from '@/analysisDisplay';
import { colors, fontFamily, radius } from '@/theme';

export default function AnalysisHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation('analysisHistory');
  const [labels, setLabels] = useState<ReturnType<typeof formatAnalysisListLabels>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAnalyses()
      .then((items) => setLabels(formatAnalysisListLabels(items)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('title')}</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>{t('common:close')}</Text>
        </Pressable>
      </View>

      {!loading && labels.length === 0 ? (
        <Text style={styles.emptyText}>{t('emptyText')}</Text>
      ) : (
        <FlatList
          data={labels}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/analysis', params: { id: String(item.id) } })}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.rowHead}>
                <Text style={styles.rowText}>{item.label}</Text>
                <View style={styles.languageBadge}>
                  <Text style={styles.languageBadgeText}>{t(`settings:languageOption.${item.locale}`)}</Text>
                </View>
              </View>
            </Pressable>
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
    paddingVertical: 16,
  },
  rowHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    fontSize: 14.5,
    fontFamily: fontFamily.bold,
    color: colors.ink,
  },
  languageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
  },
  languageBadgeText: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.inkFaint,
  },
});
