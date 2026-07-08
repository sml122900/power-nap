jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appendNapRecord,
  applyManualAdjustment,
  computeCoffeeAlarmAt,
  getNapRecords,
  getSettings,
  type Settings,
} from './store';

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
    expect(settings).toEqual({ latency: { fast: 5, slow: 15 }, caffeineOnset: 30, totalNaps: 3 });
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
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(original));

    const settings = await getSettings();
    expect(settings).toEqual(original);
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
