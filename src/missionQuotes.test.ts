jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getMissionQuotes,
  isMissionInputCorrect,
  MISSION_QUOTES,
  normalizeMissionInput,
  pickRandomQuote,
  pickShorterQuote,
  setMissionQuotes,
  type MissionQuote,
} from './missionQuotes';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('MISSION_QUOTES', () => {
  it('has 15~20 quotes per language', () => {
    expect(MISSION_QUOTES.ko.length).toBeGreaterThanOrEqual(15);
    expect(MISSION_QUOTES.ko.length).toBeLessThanOrEqual(20);
    expect(MISSION_QUOTES.en.length).toBeGreaterThanOrEqual(15);
    expect(MISSION_QUOTES.en.length).toBeLessThanOrEqual(20);
  });

  it('has no duplicate quote text within a language', () => {
    expect(new Set(MISSION_QUOTES.ko.map((q) => q.text)).size).toBe(MISSION_QUOTES.ko.length);
    expect(new Set(MISSION_QUOTES.en.map((q) => q.text)).size).toBe(MISSION_QUOTES.en.length);
  });

  it('attributes the current self-written quotes to Claude', () => {
    expect(MISSION_QUOTES.ko.every((q) => q.author === '클로드')).toBe(true);
    expect(MISSION_QUOTES.en.every((q) => q.author === 'Claude')).toBe(true);
  });
});

describe('normalizeMissionInput', () => {
  it('lowercases and strips whitespace/punctuation', () => {
    expect(normalizeMissionInput('Rise and shine')).toBe('riseandshine');
    expect(normalizeMissionInput('RISE   AND SHINE')).toBe('riseandshine');
    expect(normalizeMissionInput('Rise, and shine!')).toBe('riseandshine');
  });

  it('handles Korean punctuation/spacing the same way', () => {
    expect(normalizeMissionInput('짧은 휴식, 긴 집중')).toBe('짧은휴식긴집중');
    expect(normalizeMissionInput('짧은  휴식,긴 집중')).toBe('짧은휴식긴집중');
  });
});

describe('isMissionInputCorrect', () => {
  const quote: MissionQuote = { text: 'Rise and shine', author: 'Claude' };

  it('accepts a match that only differs in case/spacing/punctuation', () => {
    expect(isMissionInputCorrect('rise AND, shine', quote)).toBe(true);
  });

  it('rejects a genuinely different string', () => {
    expect(isMissionInputCorrect('rise and shin', quote)).toBe(false);
  });

  it('rejects empty input against a non-empty quote', () => {
    expect(isMissionInputCorrect('', quote)).toBe(false);
  });

  it('ignores the author when checking the answer', () => {
    expect(isMissionInputCorrect('rise and shine', { text: 'Rise and shine', author: 'Someone else' })).toBe(true);
  });
});

describe('pickShorterQuote', () => {
  it('always returns a quote strictly shorter than the current one when shorter ones exist', () => {
    const current = MISSION_QUOTES.en.reduce((a, b) => (b.text.length > a.text.length ? b : a)); // longest quote
    for (let i = 0; i < 20; i++) {
      const picked = pickShorterQuote(MISSION_QUOTES.en, current, () => i / 20);
      expect(picked.text.length).toBeLessThan(current.text.length);
    }
  });

  it('falls back to any other quote when the current one is already the shortest', () => {
    const shortest = MISSION_QUOTES.en.reduce((a, b) => (b.text.length < a.text.length ? b : a));
    const picked = pickShorterQuote(MISSION_QUOTES.en, shortest, () => 0);
    expect(picked.text).not.toBe(shortest.text);
  });
});

describe('pickRandomQuote', () => {
  it('deterministically picks by index via the injected random source', () => {
    expect(pickRandomQuote(MISSION_QUOTES.ko, () => 0)).toBe(MISSION_QUOTES.ko[0]);
    const lastIndex = MISSION_QUOTES.ko.length - 1;
    expect(pickRandomQuote(MISSION_QUOTES.ko, () => 0.999999)).toBe(MISSION_QUOTES.ko[lastIndex]);
  });
});

describe('getMissionQuotes / setMissionQuotes', () => {
  it('falls back to the built-in defaults when nothing is stored', async () => {
    expect(await getMissionQuotes('ko')).toEqual(MISSION_QUOTES.ko);
    expect(await getMissionQuotes('en')).toEqual(MISSION_QUOTES.en);
  });

  it('returns the saved custom list for that language only', async () => {
    await setMissionQuotes('ko', [{ text: '커스텀 명언 하나', author: '테스터' }]);
    expect(await getMissionQuotes('ko')).toEqual([{ text: '커스텀 명언 하나', author: '테스터' }]);
    expect(await getMissionQuotes('en')).toEqual(MISSION_QUOTES.en);
  });

  it('overwrites a previously saved list for the same language', async () => {
    await setMissionQuotes('en', [{ text: 'first save', author: '' }]);
    await setMissionQuotes('en', [
      { text: 'second save', author: 'A' },
      { text: 'another line', author: 'B' },
    ]);
    expect(await getMissionQuotes('en')).toEqual([
      { text: 'second save', author: 'A' },
      { text: 'another line', author: 'B' },
    ]);
  });

  it('falls back to defaults if an empty list is saved', async () => {
    await setMissionQuotes('ko', []);
    expect(await getMissionQuotes('ko')).toEqual(MISSION_QUOTES.ko);
  });

  it('normalizes legacy plain-string entries (pre-author format) without crashing', async () => {
    await AsyncStorage.setItem('powernap:missionQuotesOverride', JSON.stringify({ ko: ['옛날 형식 명언'] }));
    expect(await getMissionQuotes('ko')).toEqual([{ text: '옛날 형식 명언', author: '' }]);
  });
});
