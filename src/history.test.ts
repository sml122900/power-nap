// history.tsx가 store.ts -> @react-native-async-storage/async-storage를 끌어오므로,
// 이 파일을 직접 렌더링하지 않고 순수 함수(detailText/surveySummary)만 테스트해도
// import 체인 때문에 네이티브 모듈 목이 필요하다(store.test.ts와 동일 패턴).
//
// app/ 대신 src/에 둔 이유: expo-router의 require.context가 app/ 아래 모든 파일을
// 라우트 후보로 스캔하며 앱 시작 시점에 즉시 require한다 — 파일명에 .test.가 있어도
// 걸러지지 않는다. 이 파일은 jest.mock()(테스트 전용 전역 함수) 호출을 포함하는데,
// `jest`가 없는 실제 앱 런타임에서 그 즉시실행 코드가 "Property 'jest' doesn't exist"로
// 크래시한다(실기기 디버그 빌드에서 실재현 확인, app/history.test.ts였을 때 발생).
// settings.test.tsx/mypage.test.tsx와 같은 이유로 src/에 둔다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { detailRows, detailText, surveySummary, wakeChecklistSummary } from '../app/history';
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

describe('wakeChecklistSummary', () => {
  it('joins only the checked items with the label order fixed', () => {
    expect(wakeChecklistSummary({ stretch: false, light: false, water: true })).toBe('물');
  });

  it('renders a single checked item without a separator', () => {
    expect(wakeChecklistSummary({ stretch: true, light: false, water: false })).toBe('기지개');
  });

  it('ignores a legacy immediate field left over from the 4-field format', () => {
    const legacy = { immediate: true, stretch: false, light: false, water: false } as unknown as Parameters<
      typeof wakeChecklistSummary
    >[0];
    expect(wakeChecklistSummary(legacy)).toBe('');
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
      { label: '모드', value: '매우 졸림' },
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
      { label: '모드', value: '조금 졸림' },
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

  it('includes a wake-checklist row when at least one item is checked', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
      wakeChecklist: { stretch: true, light: false, water: true },
    };
    const rows = detailRows(record);
    expect(rows).toContainEqual({ label: '기상 루틴', value: '기지개 · 물' });
  });

  it('omits the wake-checklist row for a legacy record where only immediate was checked', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
      wakeChecklist: { immediate: true, stretch: false, light: false, water: false } as unknown as NapRecord['wakeChecklist'],
    };
    const rows = detailRows(record);
    expect(rows.some((row) => row.label === '기상 루틴')).toBe(false);
  });

  it('omits the wake-checklist row when the field is absent', () => {
    const record: NapRecord = {
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
    };
    const rows = detailRows(record);
    expect(rows.some((r) => r.label === '기상 루틴')).toBe(false);
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
