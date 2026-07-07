jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appendNapRecord,
  applyFeedback,
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
    expect(settings.converged).toEqual({ fast: false, slow: false, caffeine: false });
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
    expect(settings.converged).toEqual({ fast: true, slow: false, caffeine: false });
    expect(settings.totalNaps).toBe(12);
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
      converged: { fast: true, slow: false, caffeine: true },
      totalNaps: 3,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(original));

    const settings = await getSettings();
    expect(settings).toEqual(original);
  });
});

describe('applyFeedback — fast/slow (latency)', () => {
  it('only changes the latency for the matching mode', async () => {
    await applyFeedback('fast', 'notEnough');
    const settings = await getSettings();

    expect(settings.latency.fast).toBe(3); // 0 + unconverged step 3
    expect(settings.latency.slow).toBe(10);
    expect(settings.caffeineOnset).toBe(25);
  });

  it('flips converged on justRight and does not change latency', async () => {
    const before = await getSettings();
    const updated = await applyFeedback('slow', 'justRight');

    expect(updated.converged.slow).toBe(true);
    expect(updated.latency.slow).toBe(before.latency.slow);
  });

  it('uses step 3 before convergence and step 2 after', async () => {
    let settings = await applyFeedback('fast', 'notEnough');
    expect(settings.latency.fast).toBe(3); // 0 + 3

    settings = await applyFeedback('fast', 'justRight');
    expect(settings.converged.fast).toBe(true);
    expect(settings.latency.fast).toBe(3); // unchanged

    settings = await applyFeedback('fast', 'notEnough');
    expect(settings.latency.fast).toBe(5); // 3 + converged step 2
  });

  it('clamps at the 0 minute floor', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('fast', 'tooDeep');
    }
    const settings = await getSettings();
    expect(settings.latency.fast).toBe(0);
  });

  it('clamps at the 20 minute ceiling', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('slow', 'notEnough');
    }
    const settings = await getSettings();
    expect(settings.latency.slow).toBe(20);
  });

  it('increments totalNaps on every submission', async () => {
    await applyFeedback('fast', 'justRight');
    const settings = await applyFeedback('fast', 'notEnough');
    expect(settings.totalNaps).toBe(2);
  });
});

describe('applyFeedback — coffee (caffeineOnset)', () => {
  it('adjusts caffeineOnset and leaves latency untouched', async () => {
    const settings = await applyFeedback('coffee', 'notEnough');
    expect(settings.caffeineOnset).toBe(28); // 25 + unconverged step 3
    expect(settings.latency).toEqual({ fast: 0, slow: 10 });
  });

  it('uses its own converged flag, independent of fast/slow', async () => {
    await applyFeedback('fast', 'justRight');
    const settings = await applyFeedback('coffee', 'notEnough');
    expect(settings.converged.fast).toBe(true);
    expect(settings.converged.caffeine).toBe(false);
    expect(settings.caffeineOnset).toBe(28); // still unconverged step 3
  });

  it('clamps at the 15 minute floor', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('coffee', 'tooDeep');
    }
    const settings = await getSettings();
    expect(settings.caffeineOnset).toBe(15);
  });

  it('clamps at the 35 minute ceiling', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('coffee', 'notEnough');
    }
    const settings = await getSettings();
    expect(settings.caffeineOnset).toBe(35);
  });
});

describe('applyManualAdjustment', () => {
  it('sets latency directly for fast/slow, clamped, without touching converged', async () => {
    let settings = await applyManualAdjustment('slow', 50);
    expect(settings.latency.slow).toBe(20);
    expect(settings.converged.slow).toBe(false);

    settings = await applyManualAdjustment('slow', -5);
    expect(settings.latency.slow).toBe(0);
    expect(settings.converged.slow).toBe(false);
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
  it('recording an isTest nap does not touch latency/caffeineOnset/converged', async () => {
    await applyFeedback('fast', 'notEnough'); // 실사용 학습값이 이미 존재하는 상태를 재현
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
