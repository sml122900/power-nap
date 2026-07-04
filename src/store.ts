// AsyncStorage 래퍼 — PROJECT.md 섹션 5 (데이터 모델 & 학습 로직) 기준.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type NapMode = 'fast' | 'slow'; // 바로 잠듦 / 뒤척임

// 학습 오프셋은 (모드 × 커피 여부) 4개 버킷으로 독립 관리한다 (Phase 4-1).
export type OffsetBucket = 'fast' | 'slow' | 'fastCoffee' | 'slowCoffee';

export function bucketFor(mode: NapMode, coffee: boolean): OffsetBucket {
  if (mode === 'fast') return coffee ? 'fastCoffee' : 'fast';
  return coffee ? 'slowCoffee' : 'slow';
}

export interface Settings {
  offsets: Record<OffsetBucket, number>; // 분
  converged: Record<OffsetBucket, boolean>; // 버킷별 "딱 좋았어요" 1회 이상 여부 — 스텝 크기 분기 기준
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

// 알람 해제 → 후기 화면으로 넘어갈 때 ActiveNap 대신 이 키에 최소 정보만 옮겨 담는다.
// §6.4: 후기 화면에서 앱이 죽어도 ActiveNap이 남아있지 않아야 재실행 시 알람 화면으로
// 잘못 복원되지 않는다 — clearActiveNap을 먼저 해버리므로 필요한 값을 여기 잠시 보관해둔다.
// coffee/offsetMinutes는 버킷 판정(bucketFor)과 NapRecord 기록에 쓰인다.
export interface PendingFeedback {
  mode: NapMode;
  coffee: boolean;
  offsetMinutes: number; // 이번 낮잠에 실제 사용된(수면 중 커피 토글 재계산 포함) 오프셋 분
}

// 후기 제출 시마다 append-only로 남기는 기록 (Phase 4-1) — 현재는 UI 없음, 히스토리/분석 원료.
export type NapRecordResult = NapFeedback | 'manual';

export interface NapRecord {
  completedAt: number; // epoch ms — 후기 제출 시각
  mode: NapMode;
  coffee: boolean;
  offsetMinutes: number; // 이번 낮잠에 사용된 오프셋(분)
  result: NapRecordResult;
  manualAdjustmentMinutes?: number; // '직접 조정하기'로 제출한 경우의 변화량(분, 부호 있음)
}

const KEYS = {
  settings: 'powernap:settings',
  activeNap: 'powernap:activeNap',
  pendingFeedback: 'powernap:pendingFeedback',
  napRecords: 'powernap:napRecords',
} as const;

const DEFAULT_OFFSETS: Record<OffsetBucket, number> = {
  fast: 20,
  slow: 30,
  fastCoffee: 20,
  slowCoffee: 30,
};

const DEFAULT_CONVERGED: Record<OffsetBucket, boolean> = {
  fast: false,
  slow: false,
  fastCoffee: false,
  slowCoffee: false,
};

const DEFAULT_SETTINGS: Settings = {
  offsets: DEFAULT_OFFSETS,
  converged: DEFAULT_CONVERGED,
  totalNaps: 0,
};

export const OFFSET_MIN = 10;
export const OFFSET_MAX = 35;
const STEP_UNCONVERGED = 3;
const STEP_CONVERGED = 2;

export function clampOffset(minutes: number): number {
  return Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, minutes));
}

// 구형 저장 형태({fast, slow}만 있는 offsets)를 4버킷으로 이전한다: fastCoffee<-fast,
// slowCoffee<-slow로 복사해 기존 학습값을 유실하지 않는다. 이미 4버킷이면 그대로 통과.
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;

  let parsed: {
    offsets?: Partial<Record<OffsetBucket, number>>;
    converged?: Partial<Record<OffsetBucket, boolean>>;
    totalNaps?: number;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  const rawOffsets = parsed.offsets ?? {};
  const needsMigration = rawOffsets.fastCoffee === undefined || rawOffsets.slowCoffee === undefined;

  const offsets: Record<OffsetBucket, number> = {
    fast: rawOffsets.fast ?? DEFAULT_OFFSETS.fast,
    slow: rawOffsets.slow ?? DEFAULT_OFFSETS.slow,
    fastCoffee: rawOffsets.fastCoffee ?? rawOffsets.fast ?? DEFAULT_OFFSETS.fastCoffee,
    slowCoffee: rawOffsets.slowCoffee ?? rawOffsets.slow ?? DEFAULT_OFFSETS.slowCoffee,
  };

  const rawConverged = parsed.converged ?? {};
  const converged: Record<OffsetBucket, boolean> = {
    fast: rawConverged.fast ?? false,
    slow: rawConverged.slow ?? false,
    fastCoffee: rawConverged.fastCoffee ?? false,
    slowCoffee: rawConverged.slowCoffee ?? false,
  };

  const settings: Settings = { offsets, converged, totalNaps: parsed.totalNaps ?? 0 };

  if (needsMigration) {
    await saveSettings(settings);
  }
  return settings;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// 학습 규칙 (Phase 4-1): 버킷이 미수렴이면 스텝 ±3분, 수렴("딱 좋았어요" 1회 이상)이면 ±2분.
// 너무 깊게 잤어요 -step / 딱 좋았어요 변화 없음(해당 버킷 converged=true로 전환) / 아직 부족해요 +step.
// clamp [10, 35]. 후기는 (mode, coffee)가 가리키는 버킷에만 반영한다.
export async function applyFeedback(mode: NapMode, coffee: boolean, feedback: NapFeedback): Promise<Settings> {
  const settings = await getSettings();
  const bucket = bucketFor(mode, coffee);
  const step = settings.converged[bucket] ? STEP_CONVERGED : STEP_UNCONVERGED;
  const delta = feedback === 'tooDeep' ? -step : feedback === 'notEnough' ? step : 0;
  const nextOffset = clampOffset(settings.offsets[bucket] + delta);
  const nextConverged = feedback === 'justRight' ? true : settings.converged[bucket];

  const next: Settings = {
    offsets: { ...settings.offsets, [bucket]: nextOffset },
    converged: { ...settings.converged, [bucket]: nextConverged },
    totalNaps: settings.totalNaps + 1,
  };
  await saveSettings(next);
  return next;
}

// 후기 화면 보조 경로("직접 조정하기") 전용: 절대값을 clamp해 그대로 반영한다.
// 3버튼 학습 로직(step/converged)과 무관 — converged 플래그는 건드리지 않는다.
export async function applyManualAdjustment(
  mode: NapMode,
  coffee: boolean,
  targetOffsetMinutes: number
): Promise<Settings> {
  const settings = await getSettings();
  const bucket = bucketFor(mode, coffee);
  const nextOffset = clampOffset(targetOffsetMinutes);

  const next: Settings = {
    ...settings,
    offsets: { ...settings.offsets, [bucket]: nextOffset },
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

export async function savePendingFeedback(feedback: PendingFeedback): Promise<void> {
  await AsyncStorage.setItem(KEYS.pendingFeedback, JSON.stringify(feedback));
}

export async function getPendingFeedback(): Promise<PendingFeedback | null> {
  const raw = await AsyncStorage.getItem(KEYS.pendingFeedback);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingFeedback;
  } catch {
    return null;
  }
}

export async function clearPendingFeedback(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.pendingFeedback);
}

export async function appendNapRecord(record: NapRecord): Promise<void> {
  const records = await getNapRecords();
  records.push(record);
  await AsyncStorage.setItem(KEYS.napRecords, JSON.stringify(records));
}

export async function getNapRecords(): Promise<NapRecord[]> {
  const raw = await AsyncStorage.getItem(KEYS.napRecords);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as NapRecord[];
  } catch {
    return [];
  }
}
