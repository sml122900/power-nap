// AsyncStorage 래퍼 — PROJECT.md 섹션 5 (데이터 모델 & 학습 로직) 기준.
// Phase 4-2: 알람 = 기준시각 + 소요시간 모델로 개편.
// - 일반 낮잠(fast/slow): 알람 = 시작 + TARGET_SLEEP_MIN(상수) + latency[mode](학습)
// - 커피냅(coffee): 알람 = 커피 마신 시각 + caffeineOnset(학습)
// Phase 4-3: 자동 ±스텝 조정(및 converged) 폐지. latency/caffeineOnset은 이제 수동
// 조정(applyManualAdjustment)으로만 바뀐다 — 근거는 PROJECT.md §5 참고.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type NapMode = 'fast' | 'slow' | 'coffee'; // 바로 잠듦 / 뒤척임 / 커피냅

// 일반 낮잠의 목표 수면 시간(분) — 학습 대상 아님, 고정 상수.
export const TARGET_SLEEP_MIN = 20;

export interface Settings {
  latency: Record<'fast' | 'slow', number>; // 분 — 목표수면 외에 추가로 필요한 대기시간(수동 조정)
  caffeineOnset: number; // 분 — 커피 마신 시각부터 카페인 발현까지(수동 조정)
  totalNaps: number;
}

export interface ActiveNap {
  mode: NapMode;
  startedAt: number; // epoch ms — 낮잠(또는 커피냅 확정) 시작 시각
  alarmAt: number; // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffeeDrankAt?: number; // epoch ms — mode === 'coffee'일 때만. 커피를 실제로 마신 시각
  notificationId: string | null;
  isTest?: boolean; // 홈 화면 단축 테스트 버튼(10초/1분)으로 시작된 낮잠 — 학습에 반영하지 않는다.
}

// 레거시(Phase 4-2 이전) 3버튼 후기 결과 — 신규 레코드는 더 이상 안 씀,
// 히스토리 화면의 구형 NapRecord 렌더링 하위호환용으로만 타입을 유지한다.
export type NapFeedback = 'tooDeep' | 'justRight' | 'notEnough';
export type NapRecordResult = NapFeedback | 'manual' | 'manual-settings' | 'test';

// 알람 해제 → 후기 화면으로 넘어갈 때 ActiveNap 대신 이 키에 최소 정보만 옮겨 담는다.
// §6.4: 후기 화면에서 앱이 죽어도 ActiveNap이 남아있지 않아야 재실행 시 알람 화면으로
// 잘못 복원되지 않는다.
export interface PendingFeedback {
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 실제 사용된 총 시간(분) — NapRecord용
}

// 후기 화면 4문항 설문(Phase 4-3) — 상/중/하 3단계, latency/caffeineOnset에 영향 없음
// (순수 데이터 수집 — BACKLOG v2 AI 분석의 원료).
export type SurveyRating = 'high' | 'mid' | 'low';

export interface NapSurvey {
  posture: SurveyRating; // 자세 편안함
  noise: SurveyRating; // 소음 차단
  light: SurveyRating; // 빛 차단
  satisfaction: SurveyRating; // 수면 만족도
}

// 기상 직후 행동 체크리스트(강제성 없음, 순수 데이터 수집) — 전부 미체크면 필드 자체를
// 생략해 기존 레코드(필드 없음)와 동일한 하위 호환 형태를 유지한다.
export interface WakeChecklist {
  immediate: boolean; // 스누즈 없이 바로 일어남
  stretch: boolean; // 기지개
  light: boolean; // 밝은 빛
  water: boolean; // 물 한 잔
}

// 후기 제출 시마다 append-only로 남기는 기록 — 현재는 히스토리 열람 외 UI 없음,
// 향후 분석 기능의 원료. v1(레거시)/v2(Phase 4-3) 포맷이 공존한다 — result가 있으면
// v1, survey/manualAdjust가 있으면 v2. 신규 레코드는 항상 v2 포맷으로 남는다.
export interface NapRecord {
  completedAt: number; // epoch ms — 후기 제출 시각
  mode: NapMode;
  offsetMinutes: number; // 이번 낮잠에 사용된 총 시간(분)
  isTest?: boolean; // 테스트 낮잠(ActiveNap.isTest 승계) — 히스토리에 표시만, 학습 반영 없음.

  // v1(레거시, Phase 4-2 이전 3버튼 후기/직접조정) — 신규 레코드는 설정하지 않는다.
  result?: NapRecordResult;
  manualAdjustmentMinutes?: number; // '직접 조정하기'로 제출한 경우의 변화량(분, 부호 있음)

  // v2(Phase 4-3) — 4문항 설문 + 선택 메모. survey는 "건너뛰기" 제출 시 null.
  survey?: NapSurvey | null;
  memo?: string;
  // 수동 조정(설정 화면 또는 후기 화면 "직접 조정하기") 기록 — latency/caffeineOnset을
  // 바꾸는 유일한 경로라 어디서 왔는지(source) 구분해 남긴다.
  manualAdjust?: {
    source: 'feedback' | 'settings';
    beforeMinutes: number;
    afterMinutes: number;
  };

  // 기상 직후 행동 체크리스트 — 설문 제출/건너뛰기/직접조정 어느 경로든 체크된 항목이
  // 있으면 함께 저장. 전부 미체크면 생략(undefined).
  wakeChecklist?: WakeChecklist;
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

const DEFAULT_SETTINGS: Settings = {
  latency: DEFAULT_LATENCY,
  caffeineOnset: DEFAULT_CAFFEINE_ONSET,
  totalNaps: 0,
};

export const LATENCY_MIN = 0;
export const LATENCY_MAX = 20;
// 근거: BACKLOG.md "카페인 발현시간 근거" 섹션 참고.
export const CAFFEINE_ONSET_MIN = 15;
export const CAFFEINE_ONSET_MAX = 35;

export function clampLatency(minutes: number): number {
  return Math.min(LATENCY_MAX, Math.max(LATENCY_MIN, minutes));
}

export function clampCaffeineOnset(minutes: number): number {
  return Math.min(CAFFEINE_ONSET_MAX, Math.max(CAFFEINE_ONSET_MIN, minutes));
}

// 구형 저장 형태 마이그레이션:
// - v1({fast,slow} 2개 오프셋)과 v2({fast,slow,fastCoffee,slowCoffee} 4버킷)는 둘 다
//   offsets.fast/offsets.slow를 갖고 있어 같은 경로로 처리한다(fastCoffee/slowCoffee는
//   신규 모델(caffeineOnset)과 개념이 달라 승계하지 않고 버린다 — 사용자 확정 사항).
// - latency = clamp(offsets[mode] − TARGET_SLEEP_MIN), caffeineOnset은 항상 기본값(25)에서
//   다시 시작. `converged`는 Phase 4-3에서 폐지된 필드라 있어도 읽지 않고 버린다.
export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;

  let parsed: {
    latency?: Partial<Record<'fast' | 'slow', number>>;
    caffeineOnset?: number;
    offsets?: Partial<Record<'fast' | 'slow', number>>;
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
      totalNaps: parsed.totalNaps ?? 0,
    };
  }

  // v1 또는 v2 — offsets 기반 구형 형태.
  const rawOffsets = parsed.offsets ?? {};
  const migrated: Settings = {
    latency: {
      fast: clampLatency((rawOffsets.fast ?? TARGET_SLEEP_MIN) - TARGET_SLEEP_MIN),
      slow: clampLatency((rawOffsets.slow ?? TARGET_SLEEP_MIN + 10) - TARGET_SLEEP_MIN),
    },
    caffeineOnset: DEFAULT_CAFFEINE_ONSET,
    totalNaps: parsed.totalNaps ?? 0,
  };
  await saveSettings(migrated);
  return migrated;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// 후기 화면 "직접 조정하기" 및 설정 화면 전용: 절대값을 clamp해 그대로 반영한다.
// Phase 4-3부터 latency/caffeineOnset을 바꾸는 유일한 경로 — PROJECT.md §5 참고.
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
