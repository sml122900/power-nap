// 명언 목록 편집 — 설정 화면 "명언 수정" 링크(미션 토글 ON일 때만 노출)에서 진입.
// 명언마다 텍스트/말한 사람을 행 단위로 추가·수정·삭제한다(BACKLOG.md "알람 해제 미션" 참고).
// 원래 설정 화면 안에 인라인으로 있었는데, 설정 화면이 너무 길어진다는 사용자 피드백으로
// 별도 화면으로 분리했다.
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { getMissionQuotes, setMissionQuotes, type MissionQuote } from '@/missionQuotes';
import { fontFamily, radius, type ThemeColors } from '@/theme';
import { useThemeColors } from '@/ThemeContext';

export default function MissionQuotesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation('missionQuotes');
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // app/mission.tsx가 실제로 뽑는 언어(i18n.language)와 항상 같은 목록을 보여준다.
  const locale: 'ko' | 'en' = i18n.language === 'ko' ? 'ko' : 'en';
  const [quotes, setQuotesState] = useState<MissionQuote[]>([]);

  useEffect(() => {
    getMissionQuotes(locale).then(setQuotesState);
  }, [locale]);

  // 빈 텍스트(공백만)인 행은 저장 시 걸러낸다 — 화면에는 그대로 남아 계속 채울 수 있다.
  const persist = async (next: MissionQuote[]) => {
    await setMissionQuotes(
      locale,
      next.filter((q) => q.text.trim().length > 0)
    );
  };

  const onChangeField = (index: number, field: 'text' | 'author', value: string) => {
    setQuotesState((prev) => prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)));
  };

  const onBlurField = () => {
    persist(quotes);
  };

  const onDelete = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = quotes.filter((_, i) => i !== index);
    setQuotesState(next);
    persist(next);
  };

  const onAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuotesState((prev) => [...prev, { text: '', author: '' }]);
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
        {quotes.map((q, index) => (
          <View key={index} style={styles.row}>
            <View style={styles.fields}>
              <TextInput
                style={styles.textInput}
                value={q.text}
                onChangeText={(v) => onChangeField(index, 'text', v)}
                onBlur={onBlurField}
                placeholder={t('textPlaceholder')}
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={t('textPlaceholder')}
              />
              <TextInput
                style={styles.authorInput}
                value={q.author}
                onChangeText={(v) => onChangeField(index, 'author', v)}
                onBlur={onBlurField}
                placeholder={t('authorPlaceholder')}
                placeholderTextColor={colors.inkFaint}
                accessibilityLabel={t('authorPlaceholder')}
              />
            </View>
            <Pressable onPress={() => onDelete(index)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>{t('delete')}</Text>
            </Pressable>
          </View>
        ))}
        <Pressable onPress={onAdd} style={styles.addBtn}>
          <Text style={styles.addBtnText}>{t('add')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    gap: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fields: {
    flex: 1,
    gap: 6,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
  },
  authorInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
    fontFamily: fontFamily.regular,
    color: colors.inkSoft,
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: fontFamily.bold,
    color: colors.inkSoft,
  },
  addBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.brandOnSurface,
  },
});
