// history.tsx가 store.ts -> @react-native-async-storage/async-storage를 끌어오므로,
// 이 파일을 직접 렌더링하지 않고 순수 함수(detailText/surveySummary)만 테스트해도
// import 체인 때문에 네이티브 모듈 목이 필요하다(store.test.ts와 동일 패턴).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { detailRows, detailText, surveySummary } from './history';
import type { NapRecord } from '@/store';

describe('surveySummary', () => {
  it('formats all four ratings with 상/중/하 labels', () => {
    expect(surveySummary({ posture: 'high', noise: 'mid', light: 'low', satisfaction: 'mid' })).toBe(
      '자세상 소음중 빛하 · 만족중'
    );
  });
});

describe('detailText — v1 (legacy) vs v2 (Phase 4-3) records', () => {
  it('renders a legacy 3-button feedback record', () => {
    const record: NapRecord = { completedAt: 1, mode: 'fast', offsetMinutes: 20, result: 'justRight' };
    expect(detailText(record)).toBe('딱 좋았어요');
  });

  it('renders a legacy manual-adjustment record with the delta suffix', () => {
    const record: NapRecord = {
      completedAt: 1,
      mode: 'slow',
      offsetMinutes: 32,
      result: 'manual',
      manualAdjustmentMinutes: 3,
    };
    expect(detailText(record)).toBe('직접 조정 (+3분)');
  });

  it('renders a Phase 4-3 manualAdjust record regardless of legacy result field', () => {
    const record: NapRecord = {
      completedAt: 1,
      mode: 'coffee',
      offsetMinutes: 25,
      manualAdjust: { source: 'settings', beforeMinutes: 25, afterMinutes: 30 },
    };
    expect(detailText(record)).toBe('설정에서 조정 (25→30분)');
  });

  it('renders a submitted survey', () => {
    const record: NapRecord = {
      completedAt: 1,
      mode: 'fast',
      offsetMinutes: 20,
      survey: { posture: 'high', noise: 'high', light: 'mid', satisfaction: 'low' },
    };
    expect(detailText(record)).toBe('자세상 소음상 빛중 · 만족하');
  });

  it('renders a skipped survey', () => {
    const record: NapRecord = { completedAt: 1, mode: 'fast', offsetMinutes: 20, survey: null };
    expect(detailText(record)).toBe('설문 건너뜀');
  });
});

describe('detailRows — expanded detail view', () => {
  it('renders a legacy (v1) record with full-word result label, no survey rows', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 20,
      result: 'justRight',
    };
    const rows = detailRows(record);
    expect(rows).toEqual([
      { label: '날짜', value: expect.any(String) },
      { label: '모드', value: '바로 잠듦' },
      { label: '사용 시간', value: '20분' },
      { label: '후기 결과', value: '딱 좋았어요' },
    ]);
  });

  it('renders a Phase 4-3 (v2) submitted survey as four full-word rows', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'slow',
      offsetMinutes: 32,
      survey: { posture: 'mid', noise: 'low', light: 'high', satisfaction: 'mid' },
    };
    const rows = detailRows(record);
    expect(rows).toEqual([
      { label: '날짜', value: expect.any(String) },
      { label: '모드', value: '뒤척임' },
      { label: '사용 시간', value: '32분' },
      { label: '자세', value: '중' },
      { label: '소음', value: '하' },
      { label: '빛 차단', value: '상' },
      { label: '만족도', value: '중' },
    ]);
  });

  it('includes the full memo text when present', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
      memo: '창밖이 좀 시끄러웠음',
    };
    const rows = detailRows(record);
    expect(rows).toContainEqual({ label: '설문', value: '건너뜀' });
    expect(rows).toContainEqual({ label: '메모', value: '창밖이 좀 시끄러웠음' });
  });

  it('includes a manualAdjust row without any survey rows', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'coffee',
      offsetMinutes: 25,
      manualAdjust: { source: 'settings', beforeMinutes: 25, afterMinutes: 30 },
    };
    const rows = detailRows(record);
    expect(rows).toContainEqual({ label: '수동 조정', value: '설정에서 조정 (25→30분)' });
    expect(rows.some((r) => ['자세', '소음', '빛 차단', '만족도', '설문'].includes(r.label))).toBe(false);
  });
});
