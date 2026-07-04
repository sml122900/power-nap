jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyFeedback, applyManualAdjustment, getSettings, type Settings } from './store';

const SETTINGS_KEY = 'powernap:settings';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('getSettings migration', () => {
  it('migrates legacy {fast, slow} offsets into 4 buckets without losing values', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ offsets: { fast: 18, slow: 33 }, totalNaps: 7 }));

    const settings = await getSettings();

    expect(settings.offsets).toEqual({ fast: 18, slow: 33, fastCoffee: 18, slowCoffee: 33 });
    expect(settings.converged).toEqual({ fast: false, slow: false, fastCoffee: false, slowCoffee: false });
    expect(settings.totalNaps).toBe(7);
  });

  it('persists the migrated shape so a second load does not re-derive from a stale legacy value', async () => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ offsets: { fast: 18, slow: 33 }, totalNaps: 7 }));
    await getSettings();

    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const persisted = JSON.parse(raw as string);
    expect(persisted.offsets.fastCoffee).toBe(18);
    expect(persisted.offsets.slowCoffee).toBe(33);
  });

  it('leaves an already-4-bucket settings object untouched', async () => {
    const original: Settings = {
      offsets: { fast: 15, slow: 25, fastCoffee: 12, slowCoffee: 20 },
      converged: { fast: true, slow: false, fastCoffee: false, slowCoffee: true },
      totalNaps: 3,
    };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(original));

    const settings = await getSettings();
    expect(settings).toEqual(original);
  });
});

describe('applyFeedback', () => {
  it('only changes the bucket matching (mode, coffee)', async () => {
    await applyFeedback('fast', false, 'notEnough');
    const settings = await getSettings();

    expect(settings.offsets.fast).toBe(23); // 20 + unconverged step 3
    expect(settings.offsets.slow).toBe(30);
    expect(settings.offsets.fastCoffee).toBe(20);
    expect(settings.offsets.slowCoffee).toBe(30);
  });

  it('flips converged on justRight and does not change the offset', async () => {
    const before = await getSettings();
    const updated = await applyFeedback('slow', false, 'justRight');

    expect(updated.converged.slow).toBe(true);
    expect(updated.offsets.slow).toBe(before.offsets.slow);
  });

  it('uses step 3 before convergence and step 2 after', async () => {
    let settings = await applyFeedback('fast', false, 'notEnough');
    expect(settings.offsets.fast).toBe(23); // 20 + 3

    settings = await applyFeedback('fast', false, 'justRight');
    expect(settings.converged.fast).toBe(true);
    expect(settings.offsets.fast).toBe(23); // unchanged

    settings = await applyFeedback('fast', false, 'notEnough');
    expect(settings.offsets.fast).toBe(25); // 23 + converged step 2
  });

  it('clamps at the 10 minute floor', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('fast', true, 'tooDeep');
    }
    const settings = await getSettings();
    expect(settings.offsets.fastCoffee).toBe(10);
  });

  it('clamps at the 35 minute ceiling', async () => {
    for (let i = 0; i < 10; i++) {
      await applyFeedback('slow', false, 'notEnough');
    }
    const settings = await getSettings();
    expect(settings.offsets.slow).toBe(35);
  });

  it('increments totalNaps on every submission', async () => {
    await applyFeedback('fast', false, 'justRight');
    const settings = await applyFeedback('fast', false, 'notEnough');
    expect(settings.totalNaps).toBe(2);
  });
});

describe('applyManualAdjustment', () => {
  it('sets the bucket offset directly, clamped, without touching converged', async () => {
    let settings = await applyManualAdjustment('slow', true, 50);
    expect(settings.offsets.slowCoffee).toBe(35);
    expect(settings.converged.slowCoffee).toBe(false);

    settings = await applyManualAdjustment('slow', true, 2);
    expect(settings.offsets.slowCoffee).toBe(10);
    expect(settings.converged.slowCoffee).toBe(false);
  });

  it('does not affect other buckets', async () => {
    await applyManualAdjustment('fast', false, 27);
    const settings = await getSettings();
    expect(settings.offsets.fast).toBe(27);
    expect(settings.offsets.slow).toBe(30);
    expect(settings.offsets.fastCoffee).toBe(20);
    expect(settings.offsets.slowCoffee).toBe(30);
  });
});
