// AsyncStorage 래퍼 — PROJECT.md 섹션 5 (데이터 모델 & 학습 로직) 기준.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type NapMode = 'fast' | 'slow'; // 바로 잠듦 / 뒤척임

export interface Settings {
  offsets: Record<NapMode, number>; // 분
  totalNaps: number;
}

export interface ActiveNap {
  mode: NapMode;
  startedAt: number; // epoch ms
  alarmAt: number; // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffee: boolean;
  notificationId: string | null;
}

export type NapFeedback = 'tooDeep' | 'justRight' | 'notEnough';

const KEYS = {
  settings: 'powernap:settings',
  activeNap: 'powernap:activeNap',
} as const;

const DEFAULT_SETTINGS: Settings = {
  offsets: { fast: 20, slow: 30 },
  totalNaps: 0,
};

const OFFSET_MIN = 10;
const OFFSET_MAX = 40;
const OFFSET_STEP = 5;

function clampOffset(minutes: number): number {
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, minutes));
}

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Settings;
    return {
      offsets: { ...DEFAULT_SETTINGS.offsets, ...parsed.offsets },
      totalNaps: parsed.totalNaps ?? 0,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// 학습 규칙: 너무 깊게 잤어요 -5분 / 딱 좋았어요 변화 없음 / 아직 부족해요 +5분. clamp [10, 40].
export async function applyFeedback(mode: NapMode, feedback: NapFeedback): Promise<Settings> {
  const settings = await getSettings();
  const delta = feedback === 'tooDeep' ? -OFFSET_STEP : feedback === 'notEnough' ? OFFSET_STEP : 0;
  const nextOffset = clampOffset(settings.offsets[mode] + delta);
  const next: Settings = {
    offsets: { ...settings.offsets, [mode]: nextOffset },
    totalNaps: settings.totalNaps + 1,
  };
  await saveSettings(next);
  return next;
}

export async function getActiveNap(): Promise<ActiveNap | null> {
  const raw = await AsyncStorage.getItem(KEYS.activeNap);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveNap;
  } catch {
    return null;
  }
}

export async function saveActiveNap(nap: ActiveNap): Promise<void> {
  await AsyncStorage.setItem(KEYS.activeNap, JSON.stringify(nap));
}

export async function clearActiveNap(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.activeNap);
}
