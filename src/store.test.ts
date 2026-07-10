jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appendNapRecord,
  applyManualAdjustment,
  canRunAnalysis,
  computeCoffeeAlarmAt,
  computeSuggestionApplication,
  filterAnalyzableRecords,
  getActiveNap,
  getAiConsent,
  getCachedAnalysisDetail,
  getCachedAnalysisList,
  getNapRecords,
  getSettings,
  markMissionCompleted,
  MIN_RECORDS_FOR_ANALYSIS,
  periodSinceMs,
  resolveAnalysisDetail,
  resolveAnalysisList,
  saveActiveNap,
  setAiConsent,
  setCachedAnalysisDetail,
  setCachedAnalysisList,
  setMissionEnabled,
  type ActiveNap,
  type NapRecord,
  type Settings,
} from './store';
import type { AnalysisDetail, AnalysisListItem } from './analysisTypes';

const SETTINGS_KEY = 'powernap:settings';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getSettings migration', () => {
  it('migrates legacy v1 {fast, slow} offsets into v3 latency', async () => {
    // v1: fastCoffee/slowCoffee가 아예 없는 2-필드 저장 형태.
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ offsets: { fast: 18, slow: 33 }, totalNaps: 7 }));

    const settings = await getSettings();

    expect(settings.latency).toEqual({ fast: 0, slow: 13 }); // clamp(18-20,0,20)=0, clamp(33-20,0,20)=13
    expect(settings.caffeineOnset).toBe(25);
    expect(settings.totalNaps).toBe(7);
  });

  it('migrates legacy v2 4-bucket offsets into v3 latency (fast 17/slow 28 example)', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        offsets: { fast: 17, slow: 28, fastCoffee: 22, slowCoffee: 32 },
        converged: { fast: true, slow: false, fastCoffee: true, slowCoffee: false },
        totalNaps: 12,
      })
    );

    const settings = await getSettings();

    expect(settings.latency).toEqual({ fast: 0, slow: 8 }); // clamp(17-20,0,20)=0, clamp(28-20,0,20)=8
    expect(settings.caffeineOnset).toBe(25); // fastCoffee/slowCoffee는 승계하지 않고 기본값으로 리셋
    expect(settings.totalNaps).toBe(12);
  });

  it('drops a legacy converged field instead of reading it (Phase 4-3 removed the concept)', async () => {
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        latency: { fast: 5, slow: 15 },
        caffeineOnset: 30,
        converged: { fast: true, slow: false, caffeine: true },
        totalNaps: 3,
      })
    );

    const settings = await getSettings();
    expect(settings).toEqual({
      latency: { fast: 5, slow: 15 },
      caffeineOnset: 30,
      totalNaps: 3,
      missionEnabled: false, // 저장된 v3 객체에 없던 필드 — 기본값 false로 채워짐
    });
    expect((settings as unknown as { converged?: unknown }).converged).toBeUndefined();
  });

  it('persists the migrated shape so a second load does not re-derive from a stale legacy value', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ offsets: { fast: 18, slow: 33 }, totalNaps: 7 }));
    await getSettings();

    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const persisted = JSON.parse(raw as string);
    expect(persisted.latency).toEqual({ fast: 0, slow: 13 });
    expect(persisted.caffeineOnset).toBe(25);
  });

  it('leaves an already-v3 settings object untouched', async () => {
    const original: Settings = {
      latency: { fast: 5, slow: 15 },
      caffeineOnset: 30,
      totalNaps: 3,
      missionEnabled: true,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(original));

    const settings = await getSettings();
    expect(settings).toEqual(original);
  });
});

describe('setMissionEnabled', () => {
  it('defaults to false and round-trips a toggle without touching other fields', async () => {
    expect((await getSettings()).missionEnabled).toBe(false);

    await setMissionEnabled(true);
    const settings = await getSettings();
    expect(settings.missionEnabled).toBe(true);
    expect(settings.latency).toEqual({ fast: 0, slow: 10 });
    expect(settings.caffeineOnset).toBe(25);

    await setMissionEnabled(false);
    expect((await getSettings()).missionEnabled).toBe(false);
  });
});

describe('markMissionCompleted', () => {
  const BASE_NAP: ActiveNap = {
    mode: 'fast',
    startedAt: 1000,
    alarmAt: 2000,
    notificationId: null,
    notificationPermissionGranted: true,
  };

  it('sets missionCompleted on the active nap without touching other fields', async () => {
    await saveActiveNap(BASE_NAP);
    await markMissionCompleted();

    const nap = await getActiveNap();
    expect(nap).toEqual({ ...BASE_NAP, missionCompleted: true });
  });

  it('is a no-op when there is no active nap', async () => {
    await markMissionCompleted();
    expect(await getActiveNap()).toBeNull();
  });
});

describe('applyManualAdjustment', () => {
  it('sets latency directly for fast/slow, clamped', async () => {
    let settings = await applyManualAdjustment('slow', 50);
    expect(settings.latency.slow).toBe(20);

    settings = await applyManualAdjustment('slow', -5);
    expect(settings.latency.slow).toBe(0);
  });

  it('sets caffeineOnset directly for coffee, clamped', async () => {
    let settings = await applyManualAdjustment('coffee', 50);
    expect(settings.caffeineOnset).toBe(35);

    settings = await applyManualAdjustment('coffee', 5);
    expect(settings.caffeineOnset).toBe(15);
  });

  it('does not affect other modes', async () => {
    await applyManualAdjustment('fast', 7);
    const settings = await getSettings();
    expect(settings.latency.fast).toBe(7);
    expect(settings.latency.slow).toBe(10);
    expect(settings.caffeineOnset).toBe(25);
  });
});

describe('test nap records', () => {
  it('recording an isTest nap does not touch latency/caffeineOnset', async () => {
    await applyManualAdjustment('fast', 12); // 실사용 값이 이미 존재하는 상태를 재현
    const before = await getSettings();

    await appendNapRecord({
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 0,
      result: 'test',
      isTest: true,
    });

    const after = await getSettings();
    expect(after).toEqual(before);

    const records = await getNapRecords();
    expect(records[records.length - 1]).toEqual({
      completedAt: 1_700_000_000_000,
      mode: 'fast',
      offsetMinutes: 0,
      result: 'test',
      isTest: true,
    });
  });
});

describe('Phase 4-3 survey records', () => {
  it('round-trips a submitted survey + memo without touching latency/caffeineOnset', async () => {
    const before = await getSettings();

    await appendNapRecord({
      completedAt: 1_700_000_000_000,
      mode: 'slow',
      offsetMinutes: 32,
      survey: { posture: 'high', noise: 'mid', light: 'low', satisfaction: 'mid' },
      memo: '창밖이 좀 시끄러웠음',
    });

    const after = await getSettings();
    expect(after).toEqual(before); // 설문은 순수 데이터 수집 — latency/caffeineOnset 불변

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.survey).toEqual({ posture: 'high', noise: 'mid', light: 'low', satisfaction: 'mid' });
    expect(record.memo).toBe('창밖이 좀 시끄러웠음');
    expect(record.result).toBeUndefined(); // v2 레코드는 레거시 result 필드를 안 씀
  });

  it('round-trips a skipped survey as survey: null', async () => {
    await appendNapRecord({
      completedAt: 1_700_000_000_001,
      mode: 'coffee',
      offsetMinutes: 25,
      survey: null,
    });

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.survey).toBeNull();
    expect(record.memo).toBeUndefined();
  });

  it('round-trips a manual adjustment from the feedback screen', async () => {
    const updated = await applyManualAdjustment('slow', 14);
    expect(updated.latency.slow).toBe(14);

    await appendNapRecord({
      completedAt: 1_700_000_000_002,
      mode: 'slow',
      offsetMinutes: 30,
      manualAdjust: { source: 'feedback', beforeMinutes: 10, afterMinutes: 14 },
    });

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.manualAdjust).toEqual({ source: 'feedback', beforeMinutes: 10, afterMinutes: 14 });
    expect(record.survey).toBeUndefined();
  });

  it('records both legacy (v1) and Phase 4-3 (v2) shaped entries in the same history', async () => {
    await appendNapRecord({
      completedAt: 1_700_000_000_003,
      mode: 'fast',
      offsetMinutes: 20,
      result: 'justRight',
    });
    await appendNapRecord({
      completedAt: 1_700_000_000_004,
      mode: 'fast',
      offsetMinutes: 20,
      survey: { posture: 'mid', noise: 'mid', light: 'mid', satisfaction: 'high' },
    });

    const records = await getNapRecords();
    expect(records).toHaveLength(2);
    expect(records[0].result).toBe('justRight');
    expect(records[0].survey).toBeUndefined();
    expect(records[1].result).toBeUndefined();
    expect(records[1].survey).toEqual({ posture: 'mid', noise: 'mid', light: 'mid', satisfaction: 'high' });
  });

  it('round-trips a manualAdjust record with source ai-analysis', async () => {
    await appendNapRecord({
      completedAt: 1_700_000_000_005,
      mode: 'slow',
      offsetMinutes: 27,
      manualAdjust: { source: 'ai-analysis', beforeMinutes: 10, afterMinutes: 7 },
    });

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.manualAdjust).toEqual({ source: 'ai-analysis', beforeMinutes: 10, afterMinutes: 7 });
  });
});

describe('AI 분석 동의 게이트', () => {
  it('아무것도 저장하지 않았으면 null(아직 물어본 적 없음)', async () => {
    expect(await getAiConsent()).toBeNull();
  });

  it('동의 저장 후 true를 돌려준다', async () => {
    await setAiConsent(true);
    expect(await getAiConsent()).toBe(true);
  });

  it('거부 저장 후 false를 돌려준다(재진입 시 다시 물어봐야 함)', async () => {
    await setAiConsent(false);
    expect(await getAiConsent()).toBe(false);
  });
});

describe('canRunAnalysis — 5개 미만 비활성', () => {
  it(`기록이 ${MIN_RECORDS_FOR_ANALYSIS}개 미만이면 false`, () => {
    expect(canRunAnalysis(0)).toBe(false);
    expect(canRunAnalysis(MIN_RECORDS_FOR_ANALYSIS - 1)).toBe(false);
  });

  it(`기록이 ${MIN_RECORDS_FOR_ANALYSIS}개 이상이면 true`, () => {
    expect(canRunAnalysis(MIN_RECORDS_FOR_ANALYSIS)).toBe(true);
    expect(canRunAnalysis(MIN_RECORDS_FOR_ANALYSIS + 3)).toBe(true);
  });
});

describe('filterAnalyzableRecords — 분석 대상 기간/isTest 필터', () => {
  const base = (overrides: Partial<NapRecord>): NapRecord => ({
    completedAt: 1_700_000_000_000,
    mode: 'fast',
    offsetMinutes: 20,
    ...overrides,
  });

  it('isTest 레코드는 항상 제외한다(기간 제한 없어도)', () => {
    const records = [base({ completedAt: 100 }), base({ completedAt: 200, isTest: true })];
    expect(filterAnalyzableRecords(records).map((r) => r.completedAt)).toEqual([100]);
  });

  it('sinceMs 미만인 기록은 제외한다', () => {
    const records = [base({ completedAt: 100 }), base({ completedAt: 200 }), base({ completedAt: 300 })];
    expect(filterAnalyzableRecords(records, 200).map((r) => r.completedAt)).toEqual([200, 300]);
  });

  it('sinceMs 생략(전체)이면 기간 제한 없이 isTest만 뺀다', () => {
    const records = [base({ completedAt: 100 }), base({ completedAt: 999_999_999_999 })];
    expect(filterAnalyzableRecords(records)).toHaveLength(2);
  });
});

describe('periodSinceMs — 분석 기간 프리셋', () => {
  const now = new Date('2026-07-08T00:00:00Z').getTime();

  it('1주/2주는 now에서 각각 7일/14일을 뺀다', () => {
    expect(periodSinceMs('1w', now)).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(periodSinceMs('2w', now)).toBe(now - 14 * 24 * 60 * 60 * 1000);
  });

  it('1개월은 달력 기준 한 달 전이다(윤년/월 길이 차이 흡수)', () => {
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() - 1);
    expect(periodSinceMs('1m', now)).toBe(expected.getTime());
  });

  it("'all'은 하한이 없다(undefined)", () => {
    expect(periodSinceMs('all', now)).toBeUndefined();
  });
});

describe('AI 분석 목록/상세 로컬 캐시', () => {
  it('목록 캐시 round-trip', async () => {
    const items: AnalysisListItem[] = [{ id: 1, requestedAt: '2026-07-08T00:00:00Z', locale: 'ko' }];
    await setCachedAnalysisList(items);
    expect(await getCachedAnalysisList()).toEqual(items);
  });

  it('캐시가 없으면 빈 배열', async () => {
    expect(await getCachedAnalysisList()).toEqual([]);
  });

  it('상세 캐시는 id별로 저장되고, 없는 id는 null', async () => {
    const detail: AnalysisDetail = {
      id: 42,
      requestedAt: '2026-07-08T00:00:00Z',
      report: { latencyAdjust: null, caffeineOnsetAdjust: null, summary: 's', advice: ['a'], confidence: 'low' },
      turns: [],
      followupTurnsUsed: 0,
      turnsRemaining: 3,
      recordsUsed: 6,
      locale: 'ko',
    };
    await setCachedAnalysisDetail(detail);
    expect(await getCachedAnalysisDetail(42)).toEqual(detail);
    expect(await getCachedAnalysisDetail(99)).toBeNull();
  });
});

describe('resolveAnalysisList/resolveAnalysisDetail — 네트워크 실패 시 캐시 폴백', () => {
  it('fetched가 있으면 fetched를 쓴다', () => {
    const fetched: AnalysisListItem[] = [{ id: 1, requestedAt: 'x', locale: 'ko' }];
    const cached: AnalysisListItem[] = [{ id: 2, requestedAt: 'y', locale: 'ko' }];
    expect(resolveAnalysisList(fetched, cached)).toBe(fetched);
  });

  it('fetched가 null(네트워크 실패)이면 캐시로 폴백한다', () => {
    const cached: AnalysisListItem[] = [{ id: 2, requestedAt: 'y', locale: 'ko' }];
    expect(resolveAnalysisList(null, cached)).toBe(cached);
  });

  it('상세도 동일 — fetched 없으면 캐시', () => {
    const cachedDetail: AnalysisDetail = {
      id: 1,
      requestedAt: 'x',
      report: { latencyAdjust: null, caffeineOnsetAdjust: null, summary: 's', advice: [], confidence: 'low' },
      turns: [],
      followupTurnsUsed: 0,
      turnsRemaining: 3,
      recordsUsed: 5,
      locale: 'ko',
    };
    expect(resolveAnalysisDetail(null, cachedDetail)).toBe(cachedDetail);
    expect(resolveAnalysisDetail(null, null)).toBeNull();
  });
});

describe('computeSuggestionApplication — AI 리포트 "설정에 반영하기"', () => {
  it('latency 제안(음수 delta)을 현재 값에 더해 clamp한다', () => {
    expect(computeSuggestionApplication('slow', 10, -3)).toEqual({ before: 10, after: 7 });
  });

  it('LATENCY_MIN 아래로는 안 내려간다', () => {
    expect(computeSuggestionApplication('fast', 2, -10)).toEqual({ before: 2, after: 0 });
  });

  it('caffeineOnset 제안은 CAFFEINE_ONSET 범위로 clamp한다', () => {
    expect(computeSuggestionApplication('coffee', 25, 20)).toEqual({ before: 25, after: 35 });
    expect(computeSuggestionApplication('coffee', 25, -20)).toEqual({ before: 25, after: 15 });
  });
});

describe('wake-up routine checklist', () => {
  it('round-trips a checklist with at least one checked item', async () => {
    await appendNapRecord({
      completedAt: 1_700_000_000_005,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
      wakeChecklist: { immediate: true, stretch: false, light: true, water: false },
    });

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.wakeChecklist).toEqual({ immediate: true, stretch: false, light: true, water: false });
  });

  it('omits the field entirely when nothing is checked', async () => {
    await appendNapRecord({
      completedAt: 1_700_000_000_006,
      mode: 'fast',
      offsetMinutes: 20,
      survey: null,
      wakeChecklist: undefined,
    });

    const records = await getNapRecords();
    const record = records[records.length - 1];
    expect(record.wakeChecklist).toBeUndefined();
    expect('wakeChecklist' in record).toBe(false);
  });
});

describe('computeCoffeeAlarmAt', () => {
  const now = 1_700_000_000_000;

  it('uses the naive coffeeDrankAt + caffeineOnset when there is enough lead time', () => {
    const coffeeDrankAt = now; // 방금
    const result = computeCoffeeAlarmAt(coffeeDrankAt, 25, now);
    expect(result).toEqual({ alarmAt: coffeeDrankAt + 25 * 60_000, corrected: false });
  });

  it('corrects to now+10min when the naive result is less than 60s away', () => {
    // 30분 전에 마셨고 발현시간이 15분(최소값)이면 이미 15분 지난 시점 — 과거.
    const coffeeDrankAt = now - 30 * 60_000;
    const result = computeCoffeeAlarmAt(coffeeDrankAt, 15, now);
    expect(result).toEqual({ alarmAt: now + 10 * 60_000, corrected: true });
  });

  it('corrects exactly at the 60s boundary (naive result under now+60s)', () => {
    const coffeeDrankAt = now;
    // caffeineOnset을 아주 작게 잡아 now+59초가 되도록 구성 (분 단위 caffeineOnset이라
    // 정확히 59초를 표현할 수 없으므로 coffeeDrankAt을 음수 오프셋으로 보정).
    const result = computeCoffeeAlarmAt(coffeeDrankAt - 59_000, 1, now);
    expect(result.corrected).toBe(true);
    expect(result.alarmAt).toBe(now + 10 * 60_000);
  });
});
