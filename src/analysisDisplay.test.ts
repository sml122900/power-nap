import { formatAnalysisListLabels, formatFreeResetCountdown, turnsToExchanges } from './analysisDisplay';
import i18n from './i18n';

describe('formatAnalysisListLabels', () => {
  it('같은 날짜가 1건뿐이면 날짜만 표시한다', () => {
    const labels = formatAnalysisListLabels([{ id: 1, requestedAt: '2026-07-08T05:00:00Z' }]);
    expect(labels).toEqual([{ id: 1, requestedAt: '2026-07-08T05:00:00Z', label: '7월 8일 분석' }]);
  });

  it('같은 날짜가 여러 건이면 시각을 병기한다', () => {
    const items = [
      { id: 1, requestedAt: new Date(2026, 6, 8, 5, 0).toISOString() },
      { id: 2, requestedAt: new Date(2026, 6, 8, 14, 30).toISOString() },
    ];
    const labels = formatAnalysisListLabels(items);
    expect(labels[0].label).toContain('7월 8일 분석 (');
    expect(labels[1].label).toContain('7월 8일 분석 (');
    expect(labels[0].label).not.toBe(labels[1].label);
  });

  it('다른 날짜는 서로 영향을 주지 않는다', () => {
    const items = [
      { id: 1, requestedAt: new Date(2026, 6, 8, 5, 0).toISOString() },
      { id: 2, requestedAt: new Date(2026, 6, 9, 5, 0).toISOString() },
    ];
    const labels = formatAnalysisListLabels(items);
    expect(labels[0].label).toBe('7월 8일 분석');
    expect(labels[1].label).toBe('7월 9일 분석');
  });

  it('영어 로케일에서는 월 이름 표기를 쓴다(MM/DD·DD/MM 모호성 방지)', async () => {
    await i18n.changeLanguage('en');
    const labels = formatAnalysisListLabels([{ id: 1, requestedAt: new Date(2026, 6, 8, 5, 0).toISOString() }]);
    expect(labels[0].label).toBe('Analysis — Jul 8');
    await i18n.changeLanguage('ko');
  });
});

describe('turnsToExchanges', () => {
  it('[user, assistant] 쌍을 Q&A로 묶는다', () => {
    const turns = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2' },
      { role: 'assistant' as const, content: 'a2' },
    ];
    expect(turnsToExchanges(turns)).toEqual([
      { question: 'q1', answer: 'a1' },
      { question: 'q2', answer: 'a2' },
    ]);
  });

  it('빈 배열은 빈 배열', () => {
    expect(turnsToExchanges([])).toEqual([]);
  });

  it('마지막에 짝 안 맞는 홀수 항목은 무시한다', () => {
    const turns = [
      { role: 'user' as const, content: 'q1' },
      { role: 'assistant' as const, content: 'a1' },
      { role: 'user' as const, content: 'q2-dangling' },
    ];
    expect(turnsToExchanges(turns)).toEqual([{ question: 'q1', answer: 'a1' }]);
  });
});

describe('formatFreeResetCountdown', () => {
  it('0 이하는 "곧"', () => {
    expect(formatFreeResetCountdown(0)).toBe('곧');
    expect(formatFreeResetCountdown(-1000)).toBe('곧');
  });

  it('1시간 미만은 분만 표시한다(0일 0시간 접두 없음)', () => {
    expect(formatFreeResetCountdown(32 * 60_000)).toBe('32분');
  });

  it('1일 미만은 시간+분을 표시한다', () => {
    expect(formatFreeResetCountdown(14 * 60 * 60_000 + 5 * 60_000)).toBe('14시간 5분');
  });

  it('1일 이상은 일+시간+분을 전부 표시한다(시간이 0이어도)', () => {
    const oneDayFiveMin = 24 * 60 * 60_000 + 5 * 60_000;
    expect(formatFreeResetCountdown(oneDayFiveMin)).toBe('1일 0시간 5분');
  });

  it('2일 14시간 32분', () => {
    const ms = 2 * 24 * 60 * 60_000 + 14 * 60 * 60_000 + 32 * 60_000;
    expect(formatFreeResetCountdown(ms)).toBe('2일 14시간 32분');
  });
});
