import { formatAnalysisListLabels, turnsToExchanges } from './analysisDisplay';

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
