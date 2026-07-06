// AsyncStorage 래퍼 — PROJECT.md 섹션 5 (데이터 모델 & 학습 로직) 기준.
// Phase 4-2: 알람 = 기준시각 + 소요시간 모델로 개편.
// - 일반 낮잠(fast/slow): 알람 = 시작 + TARGET_SLEEP_MIN(상수) + latency[mode](학습)
// - 커피냅(coffee): 알람 = 커피 마신 시각 + caffeineOnset(학습)

import AsyncStorage from '@react-native-async-storage/async-storage';

export type NapMode = 'fast' | 'slow' | 'coffee'; // 바로 잠듦 / 뒤척임 / 커피냅

// 일반 낮잠의 목표 수면 시간(분) — 학습 대상 아님, 고정 상수.
export const TARGET_SLEEP_MIN = 20;

export interface Settings {
  latency: Record<'fast' | 'slow', number>; // 분 — 목표수면 외에 추가로 필요한 대기시간(학습)
  caffeineOnset: number; // 분 — 커피 마신 시각부터 카페인 발현까지(학습)
  converged: Record<'fast' | 'slow' | 'caffeine', boolean>; // "딱 좋았어요" 1회 이상 여부 — 스텝 크기 분기 기준
  totalNaps: number;
}

export interface ActiveNap {
  mode: NapMode;
  startedAt: number; // epoch ms — 낮잠(또는 커피냅 확정) 시작 시각
  alarmAt: number; // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffeeDrankAt?: number; // epoch ms — mode === 'coffee'일 때만. 커피를 실제로 마신 시각
  notificationId: string | null;
}

export type NapFeedback = 'tooDeep' | 'justRight' | 'notEnough';

// 알람 해제 → 후기 화면으로 넘어갈 때 ActiveNap 대신 이 키에 최소 정보만 옮겨 담는다.
// §6.4: 후기 화면에서 앱이 죽어도 ActiveNap이 남아있지 않아야 재실행 시 알람 화면으로
// 잘못 복원되지 않는다.
export interface PendingFeedback {
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 실제 사용된 총 시간(분) — NapRecord용
}

// 후기 제출 시마다 append-only로 남기는 기록 (Phase 4-1) — 현재는 UI 없음, 히스토리/분석 원료.
export type NapRecordResult = NapFeedback | 'manual';

export interface NapRecord {
  completedAt: number; // epoch ms — 후기 제출 시각
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 사용된 총 시간(분)
  result: NapRecordResult;
  manualAdjustmentMinutes?: number; // '직접 조정하기'로 제출한 경우의 변화량(분, 부호 있음)
}

const KEYS = {
  settings: 'powernap:settings',
  activeNap: 'powernap:activeNap',
  pendingFeedback: 'powernap:pendingFeedback',
  napRecords: 'powernap:napRecords',
} as const;

// v2({fast,slow,fastCoffee,slowCoffee} 오프셋) 시절의 기본값과 동일한 총 시간이 나오도록
// 맞춘 값 — fast: 20(=TARGET_SLEEP_MIN+0), slow: 30(=TARGET_SLEEP_MIN+10).
const DEFAULT_LATENCY: Record<'fast' | 'slow', number> = { fast: 0, slow: 10 };
const DEFAULT_CAFFEINE_ONSET = 25;

const DEFAULT_CONVERGED: Record<'fast' | 'slow' | 'caffeine', boolean> = {
  fast: false,
  slow: false,
  caffeine: false,
};

const DEFAULT_SETTINGS: Settings = {
  latency: DEFAULT_LATENCY,
  caffeineOnset: DEFAULT_CAFFEINE_ONSET,
  converged: DEFAULT_CONVERGED,
  totalNaps: 0,
};

export const LATENCY_MIN = 0;
export const LATENCY_MAX = 20;
// 근거: BACKLOG.md "카페인 발현시간 근거" 섹션 참고.
export const CAFFEINE_ONSET_MIN = 15;
export const CAFFEINE_ONSET_MAX = 35;

const STEP_UNCONVERGED = 3;
const STEP_CONVERGED = 2;

export function clampLatency(minutes: number): number {
  return Math.min(LATENCY_MAX, Math.max(LATENCY_MIN, minutes));
}

export function clampCaffeineOnset(minutes: number): number {
  return Math.min(CAFFEINE_ONSET_MAX, Math.max(CAFFEINE_ONSET_MIN, minutes));
}

// 해당 모드에 다음 후기가 적용될 스텝 크기(분) — 후기 화면 미리보기 라벨이 이 값을
// 하드코딩하지 않고 재사용해야 실제 적용값과 어긋나지 않는다.
export function stepFor(settings: Settings, mode: NapMode): number {
  const convergedKey = mode === 'coffee' ? 'caffeine' : mode;
  return settings.converged[convergedKey] ? STEP_CONVERGED : STEP_UNCONVERGED;
}

// 구형 저장 형태 마이그레이션:
// - v1({fast,slow} 2개 오프셋)과 v2({fast,slow,fastCoffee,slowCoffee} 4버킷)는 둘 다
//   offsets.fast/offsets.slow를 갖고 있어 같은 경로로 처리한다(fastCoffee/slowCoffee는
//   신규 모델(caffeineOnset)과 개념이 달라 승계하지 않고 버린다 — 사용자 확정 사항).
// - latency = clamp(offsets[mode] − TARGET_SLEEP_MIN), caffeineOnset은 항상 기본값(25)에서
//   다시 시작, converged.fast/slow는 승계, converged.caffeine은 false.
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;

  let parsed: {
    latency?: Partial<Record<'fast' | 'slow', number>>;
    caffeineOnset?: number;
    offsets?: Partial<Record<'fast' | 'slow', number>>;
    converged?: Partial<Record<'fast' | 'slow' | 'caffeine', boolean>>;
    totalNaps?: number;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (parsed.latency) {
    // 이미 v3 형태.
    return {
      latency: {
        fast: parsed.latency.fast ?? DEFAULT_LATENCY.fast,
        slow: parsed.latency.slow ?? DEFAULT_LATENCY.slow,
      },
      caffeineOnset: parsed.caffeineOnset ?? DEFAULT_CAFFEINE_ONSET,
      converged: {
        fast: parsed.converged?.fast ?? false,
        slow: parsed.converged?.slow ?? false,
        caffeine: parsed.converged?.caffeine ?? false,
      },
      totalNaps: parsed.totalNaps ?? 0,
    };
  }

  // v1 또는 v2 — offsets 기반 구형 형태.
  const rawOffsets = parsed.offsets ?? {};
  const rawConverged = parsed.converged ?? {};
  const migrated: Settings = {
    latency: {
      fast: clampLatency((rawOffsets.fast ?? TARGET_SLEEP_MIN) - TARGET_SLEEP_MIN),
      slow: clampLatency((rawOffsets.slow ?? TARGET_SLEEP_MIN + 10) - TARGET_SLEEP_MIN),
    },
    caffeineOnset: DEFAULT_CAFFEINE_ONSET,
    converged: {
      fast: rawConverged.fast ?? false,
      slow: rawConverged.slow ?? false,
      caffeine: false,
    },
    totalNaps: parsed.totalNaps ?? 0,
  };
  await saveSettings(migrated);
  return migrated;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// 학습 규칙 (Phase 4-2): 미수렴이면 스텝 ±3분, 수렴("딱 좋았어요" 1회 이상)이면 ±2분.
// 너무 깊게 잤어요 -step / 딱 좋았어요 변화 없음(converged=true로 전환) / 아직 부족해요 +step.
// fast/slow는 latency[mode]에 반영(clamp 0~20), coffee는 caffeineOnset에 반영(clamp 15~35).
export async function applyFeedback(mode: NapMode, feedback: NapFeedback): Promise<Settings> {
  const settings = await getSettings();
  const step = stepFor(settings, mode);
  const delta = feedback === 'tooDeep' ? -step : feedback === 'notEnough' ? step : 0;

  if (mode === 'coffee') {
    const nextCaffeineOnset = clampCaffeineOnset(settings.caffeineOnset + delta);
    const nextConverged = feedback === 'justRight' ? true : settings.converged.caffeine;
    const next: Settings = {
      ...settings,
      caffeineOnset: nextCaffeineOnset,
      converged: { ...settings.converged, caffeine: nextConverged },
      totalNaps: settings.totalNaps + 1,
    };
    await saveSettings(next);
    return next;
  }

  const nextLatency = clampLatency(settings.latency[mode] + delta);
  const nextConverged = feedback === 'justRight' ? true : settings.converged[mode];
  const next: Settings = {
    ...settings,
    latency: { ...settings.latency, [mode]: nextLatency },
    converged: { ...settings.converged, [mode]: nextConverged },
    totalNaps: settings.totalNaps + 1,
  };
  await saveSettings(next);
  return next;
}

// 후기 화면 보조 경로("직접 조정하기") 전용: 절대값을 clamp해 그대로 반영한다.
// 3버튼 학습 로직(step/converged)과 무관 — converged 플래그는 건드리지 않는다.
// fast/slow는 latency를, coffee는 caffeineOnset을 직접 설정한다.
export async function applyManualAdjustment(mode: NapMode, targetMinutes: number): Promise<Settings> {
  const settings = await getSettings();

  if (mode === 'coffee') {
    const next: Settings = {
      ...settings,
      caffeineOnset: clampCaffeineOnset(targetMinutes),
      totalNaps: settings.totalNaps + 1,
    };
    await saveSettings(next);
    return next;
  }

  const next: Settings = {
    ...settings,
    latency: { ...settings.latency, [mode]: clampLatency(targetMinutes) },
    totalNaps: settings.totalNaps + 1,
  };
  await saveSettings(next);
  return next;
}

// 커피냅 알람 시각 계산 — 계산 결과가 now+60초 미만이면(이미 카페인이 돌고 있을 시점)
// 최소 now+10분으로 보정한다. 프리셋 칩(방금/5분전/10분전)과 직접 입력 모두 이 함수를
// 거친다 — clamp 범위(caffeineOnset 15~35, 직접입력 0~120분전) 상 프리셋에서는 사실상
// corrected가 발생하지 않지만, 로직을 한 곳에 모아 일관되게 검증한다.
const CAFFEINE_ALREADY_ACTIVE_LEAD_MS = 60_000;
const CAFFEINE_CORRECTION_MIN = 10;

export function computeCoffeeAlarmAt(
  coffeeDrankAt: number,
  caffeineOnsetMinutes: number,
  now: number
): { alarmAt: number; corrected: boolean } {
  const naive = coffeeDrankAt + caffeineOnsetMinutes * 60_000;
  if (naive < now + CAFFEINE_ALREADY_ACTIVE_LEAD_MS) {
    return { alarmAt: now + CAFFEINE_CORRECTION_MIN * 60_000, corrected: true };
  }
  return { alarmAt: naive, corrected: false };
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
