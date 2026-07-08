import { formatDateTime, formatTime } from './format';
import i18n, { SUPPORTED_LANGUAGES } from './i18n';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

// jest.i18n.setup.js가 매 테스트 전에 'ko'로 되돌려준다 — 여기서 바꾼 언어는 다음 테스트에
// 영향을 주지 않는다.

describe('language switching', () => {
  it('defaults to ko (forced by jest.i18n.setup.js regardless of the mocked en-US device locale)', () => {
    expect(i18n.language).toBe('ko');
    expect(i18n.t('common:close')).toBe('닫기');
  });

  it('changeLanguage(en) immediately loads the bundled en resources', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.language).toBe('en');
    expect(i18n.t('common:close')).toBe('Close');
    expect(i18n.t('home:title')).toBe(en.home.title);
  });

  it('changeLanguage back to ko restores ko resources', async () => {
    await i18n.changeLanguage('en');
    await i18n.changeLanguage('ko');
    expect(i18n.t('common:close')).toBe('닫기');
    expect(i18n.t('home:title')).toBe(ko.home.title);
  });

  it('SUPPORTED_LANGUAGES lists exactly the languages with bundled resources', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['ko', 'en']);
  });
});

describe('locale-aware time/date formatting', () => {
  const date = new Date(2026, 6, 8, 15, 5); // 2026-07-08 15:05 local

  it('formats time in Korean AM/PM style for ko', () => {
    expect(formatTime(date, 'ko')).toBe('오후 3:05');
  });

  it('formats time in English AM/PM style for en', () => {
    expect(formatTime(date, 'en')).toBe('3:05 PM');
  });

  it('formats date+time in Korean style for ko', () => {
    expect(formatDateTime(date, 'ko')).toBe('7월 8일 오후 3:05');
  });

  it('formats date+time in English style for en', () => {
    expect(formatDateTime(date, 'en')).toBe('Jul 8, 3:05 PM');
  });

  it('defaults to the current i18n.language when no language arg is passed', async () => {
    await i18n.changeLanguage('en');
    expect(formatTime(date)).toBe('3:05 PM');
    await i18n.changeLanguage('ko');
    expect(formatTime(date)).toBe('오후 3:05');
  });
});

describe('locale resource key parity (no missing translations)', () => {
  function flattenKeys(obj: unknown, prefix = ''): string[] {
    if (typeof obj !== 'object' || obj === null) return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      flattenKeys(value, prefix ? `${prefix}.${key}` : key)
    );
  }

  it('ko.json and en.json declare exactly the same set of keys', () => {
    const koKeys = flattenKeys(ko).sort();
    const enKeys = flattenKeys(en).sort();
    expect(enKeys).toEqual(koKeys);
  });

  it('no translation value is an empty string in either language', () => {
    const collectValues = (obj: unknown, path = ''): [string, unknown][] => {
      if (typeof obj !== 'object' || obj === null) return [[path, obj]];
      return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
        collectValues(value, path ? `${path}.${key}` : key)
      );
    };
    for (const [path, value] of [...collectValues(ko), ...collectValues(en)]) {
      expect(typeof value === 'string' && value.length > 0).toBe(true);
      if (!(typeof value === 'string' && value.length > 0)) throw new Error(`empty value at ${path}`);
    }
  });
});
