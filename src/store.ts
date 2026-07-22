// AsyncStorage 래퍼 — PROJECT.md 섹션 5 (데이터 모델 & 학습 로직) 기준.
// Phase 4-2: 알람 = 기준시각 + 소요시간 모델로 개편.
// - 일반 낮잠(fast/slow): 알람 = 시작 + TARGET_SLEEP_MIN(상수) + latency[mode](학습)
// - 커피냅(coffee): 알람 = 커피 마신 시각 + caffeineOnset(학습)
// Phase 4-3: 자동 ±스텝 조정(및 converged) 폐지. latency/caffeineOnset은 이제 수동
// 조정(applyManualAdjustment)으로만 바뀐다 — 근거는 PROJECT.md §5 참고.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AnalysisDetail, AnalysisListItem } from './analysisTypes';

export type NapMode = 'fast' | 'slow' | 'coffee'; // 바로 잠듦 / 뒤척임 / 커피냅

// 일반 낮잠의 목표 수면 시간(분) — 학습 대상 아님, 고정 상수.
export const TARGET_SLEEP_MIN = 20;

export interface Settings {
  latency: Record<'fast' | 'slow', number>; // 분 — 목표수면 외에 추가로 필요한 대기시간(수동 조정)
  caffeineOnset: number; // 분 — 커피 마신 시각부터 카페인 발현까지(수동 조정)
  totalNaps: number;
  // 알람 해제 미션(명언 타이핑) on/off — 기본 false(기존 사용자 경험 보호).
  // true면 알람 발화 시 슬라이드/롱프레스 해제 화면(/alarm) 전에 /mission을 먼저 거친다
  // (useNapWatchdog.resolveNapRoute 참고).
  missionEnabled: boolean;
  // 기상 직후 행동 시퀀스(/wake-stretch → /wake-light → /wake-water) on/off — 기본 true.
  // true면 알람(또는 미션) 해제 직후 설문(/feedback) 전에 이 3화면을 먼저 거친다
  // (src/finishNap.ts의 resolveFinishNapDestination 참고). 명언 미션과는 목적이 달라
  // 독립적으로 켜고 끌 수 있다.
  wakeRoutineEnabled: boolean;
}

export interface ActiveNap {
  mode: NapMode;
  startedAt: number; // epoch ms — 낮잠(또는 커피냅 확정) 시작 시각
  alarmAt: number; // epoch ms — 절대시각. 카운트다운은 항상 이 값 기준
  coffeeDrankAt?: number; // epoch ms — mode === 'coffee'일 때만. 커피를 실제로 마신 시각
  notificationId: string | null;
  // 알림 권한(POST_NOTIFICATIONS) 승인 여부 — Android에서 알람 자체의 성패와는 무관하다
  // (notificationId와 별개 필드로 둔 이유. src/notifications.ts 상단 주석 참고). 수면
  // 화면이 이 값으로 안내 문구 분기를 결정한다(notificationId===null로 판단하던 방식은
  // Android에서 항상 notificationId가 채워지게 되며 더 이상 유효하지 않음).
  notificationPermissionGranted: boolean;
  isTest?: boolean; // 홈 화면 단축 테스트 버튼(10초/1분)으로 시작된 낮잠 — 학습에 반영하지 않는다.
  // 홈 화면 "10초 알람 체험" 버튼으로 시작된 낮잠 — SHOW_TEST_BUTTONS와 무관하게 출시
  // 빌드에도 상시 노출되는 사용자 기능이라 isTest와 개념·플래그를 분리했다(QA용 isTest는
  // 손대지 않음, docs/decisions/preview-mode-isTest-vs-isPreview.md 참고). isTest처럼
  // 기록에 남기되 표시만 다르게 하는 게 아니라, appendNapRecord 자체를 스킵해 기록·AI
  // 분석·설정값(latency/caffeineOnset/totalNaps) 어디에도 흔적을 남기지 않는다
  // (app/feedback.tsx의 shouldRecordNap 가드).
  isPreview?: boolean;
  // 알람 화면의 슬라이드/롱프레스를 이번 낮잠에서 이미 통과했는지 — 미션이 켜져 있으면
  // 이 이후에 /mission으로 넘어가고(§순서: 슬라이드 먼저, 명언 나중), 알람음/진동은
  // 미션까지 계속 울린다(실제 정지·기록 저장은 미션 통과 시점 — src/finishNap.ts).
  // useNapWatchdog이 재판정할 때(예: 화면 전환 중 앱을 백그라운드로 보냈다 복귀) 다시
  // /alarm으로 돌려보내지 않기 위한 값.
  alarmDismissed?: boolean;
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
  // 기상 루틴 3화면(/wake-stretch → /wake-light → /wake-water)을 지나며 하나씩 채워진다
  // (markWakeChecklistItem). 기상 루틴이 꺼져 있으면 계속 undefined.
  wakeChecklist?: WakeChecklist;
  // 테스트 낮잠(ActiveNap.isTest 승계) — true면 wake-water 화면이 /feedback 대신
  // 여기서 기록을 마무리하고 홈으로 보낸다(src/finishNap.ts 참고, 학습 오염 방지).
  isTest?: boolean;
  // 체험 낮잠(ActiveNap.isPreview 승계) — /feedback까지 그대로 도달해 UI는 동일하게
  // 겪지만, shouldRecordNap 가드가 appendNapRecord/applyManualAdjustment 둘 다 건너뛴다.
  isPreview?: boolean;
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

// 기상 직후 행동 시퀀스(wake-sequence, /wake-stretch → /wake-light → /wake-water) —
// 각 화면을 밀어서 넘기면 해당 값이 true로 기록된다(markWakeChecklistItem).
// 예전엔 4번째 필드로 immediate(스누즈 없이 바로 일어남)도 있었으나, 기상 루틴이
// "슬라이드 해제 직후 곧장 진입하는 화면 시퀀스"로 바뀌면서 그 자체가 즉시 기상을
// 함의하게 돼 별도 항목으로 물을 필요가 없어져 제거했다 — 구 레코드(4필드, immediate
// 포함)를 읽을 때는 그냥 무시한다(마이그레이션 불필요, 타입에 없는 여분 필드로 남을 뿐).
export interface WakeChecklist {
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
  // isPreview 필드는 의도적으로 없다 — 체험 낮잠은 shouldRecordNap 가드가 appendNapRecord
  // 호출 자체를 건너뛰므로 NapRecord가 만들어지지 않는다(즉 여기 도달하는 레코드는 전부
  // isPreview:false와 동치). filterAnalyzableRecords도 그래서 isPreview를 볼 필요가 없다.

  // v1(레거시, Phase 4-2 이전 3버튼 후기/직접조정) — 신규 레코드는 설정하지 않는다.
  result?: NapRecordResult;
  manualAdjustmentMinutes?: number; // '직접 조정하기'로 제출한 경우의 변화량(분, 부호 있음)

  // v2(Phase 4-3) — 4문항 설문 + 선택 메모. survey는 "건너뛰기" 제출 시 null.
  survey?: NapSurvey | null;
  memo?: string;
  // 수동 조정(설정 화면 또는 후기 화면 "직접 조정하기") 기록 — latency/caffeineOnset을
  // 바꾸는 유일한 경로라 어디서 왔는지(source) 구분해 남긴다.
  manualAdjust?: {
    source: 'feedback' | 'settings' | 'ai-analysis';
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
  aiConsent: 'powernap:aiConsent',
  analysisListCache: 'powernap:analysisListCache',
  analysisDetailCache: 'powernap:analysisDetailCache',
} as const;

// AI_ANALYSIS.md §2 "분석 가능 조건: NapRecord 최소 5개 이상" — 클라이언트(진입점 비활성)와
// Edge Function(422 판정) 양쪽이 같은 값을 써야 해서 여기서 export한다.
export const MIN_RECORDS_FOR_ANALYSIS = 5;

export function canRunAnalysis(recordCount: number): boolean {
  return recordCount >= MIN_RECORDS_FOR_ANALYSIS;
}

// 분석 대상에서 뺄 레코드 판단 — isTest는 항상 제외(학습 미반영 원칙과 동일하게 분석에서도
// 뺀다), sinceMs가 있으면 그 시각 이후 기록만. sinceMs 생략(전체 프리셋)이면 기간 제한 없음.
export function filterAnalyzableRecords(records: NapRecord[], sinceMs?: number): NapRecord[] {
  return records.filter((r) => !r.isTest && (sinceMs === undefined || r.completedAt >= sinceMs));
}

// 체험 낮잠(isPreview)은 기록·학습값 어디에도 흔적을 남기지 않는다 — QA 테스트 낮잠
// (isTest)은 기록엔 남고 AI 분석에서만 빠지는 것과 다르다(docs/decisions/
// preview-mode-isTest-vs-isPreview.md). app/feedback.tsx의 제출/건너뛰기/직접조정
// 3경로 모두 이 함수로 appendNapRecord 호출 여부를 판단하고, 직접조정은 추가로
// applyManualAdjustment(설정값 변경)도 같은 조건으로 건너뛴다.
export function shouldRecordNap(ctx: { isPreview?: boolean }): boolean {
  return !ctx.isPreview;
}

// 홈 화면 위젯(S/M/L) 버튼 탭 → 딥링크(powernap:///?widgetMode=fast|slow|coffee)로 앱이
// 열렸을 때 취할 동작 판정 — resolveNapRoute와 같은 이유로 순수 함수로 뺀다. 이미
// ActiveNap이 있으면(다른 낮잠이 진행 중) 새 알람을 걸지 않고 안내만 한다(기존 알람 유지 —
// 취소 누락과 반대로 "의도치 않은 재예약"도 유령 알람 부류의 사고라 막는다). coffee는
// 위젯에서 시각을 입력받을 수 없어(RemoteViews는 정적 뷰) 앱의 기존 인라인 커피냅
// 패널(칩+직접입력)을 펼치기만 한다 — 새 화면이 아니다.
export type WidgetMode = NapMode;

export type WidgetModeAction =
  | { kind: 'alreadyNapping' }
  | { kind: 'openCoffeePanel' }
  | { kind: 'startNap'; mode: 'fast' | 'slow' };

export function resolveWidgetModeAction(mode: WidgetMode, hasActiveNap: boolean): WidgetModeAction {
  if (hasActiveNap) return { kind: 'alreadyNapping' };
  if (mode === 'coffee') return { kind: 'openCoffeePanel' };
  return { kind: 'startNap', mode };
}

export type AnalysisPeriod = '1w' | '2w' | '1m' | 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

// 분석 요청 화면의 기간 프리셋 → sinceMs(그 시각 이후만 분석 대상). 'all'은 하한 없음.
export function periodSinceMs(period: AnalysisPeriod, nowMs: number): number | undefined {
  switch (period) {
    case '1w':
      return nowMs - 7 * DAY_MS;
    case '2w':
      return nowMs - 14 * DAY_MS;
    case '1m': {
      const d = new Date(nowMs);
      d.setMonth(d.getMonth() - 1);
      return d.getTime();
    }
    case 'all':
      return undefined;
  }
}

// v2({fast,slow,fastCoffee,slowCoffee} 오프셋) 시절의 기본값과 동일한 총 시간이 나오도록
// 맞춘 값 — fast: 20(=TARGET_SLEEP_MIN+0), slow: 30(=TARGET_SLEEP_MIN+10).
const DEFAULT_LATENCY: Record<'fast' | 'slow', number> = { fast: 0, slow: 10 };
const DEFAULT_CAFFEINE_ONSET = 25;

const DEFAULT_SETTINGS: Settings = {
  latency: DEFAULT_LATENCY,
  caffeineOnset: DEFAULT_CAFFEINE_ONSET,
  totalNaps: 0,
  missionEnabled: false,
  wakeRoutineEnabled: true,
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

// AI 분석 리포트의 ± 제안(delta)을 현재 설정에 적용했을 때 나올 값 — analysis.tsx
// "설정에 반영하기" 버튼이 쓴다. 여기 두는 이유: analysis.tsx는 aiAnalysis.ts(→
// supabase.ts, 모듈 로드 시 env var 없으면 throw)를 끌어와서 화면 컴포넌트를 통해
// import하면 .env 없는 환경에서 테스트가 못 돈다 — store.ts는 그런 부작용이 없다.
export function computeSuggestionApplication(
  mode: 'fast' | 'slow' | 'coffee',
  currentValue: number,
  delta: number
): { before: number; after: number } {
  const clamp = mode === 'coffee' ? clampCaffeineOnset : clampLatency;
  return { before: currentValue, after: clamp(currentValue + delta) };
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
    missionEnabled?: boolean;
    wakeRoutineEnabled?: boolean;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (parsed.latency) {
    // 이미 v3 형태(missionEnabled/wakeRoutineEnabled는 각각 추가된 시점이 달라 없으면
    // 기본값으로 채운다 — missionEnabled는 기존 사용자 경험 보호 위해 false, wakeRoutineEnabled는
    // 사용자 지시로 기본 true).
    return {
      latency: {
        fast: parsed.latency.fast ?? DEFAULT_LATENCY.fast,
        slow: parsed.latency.slow ?? DEFAULT_LATENCY.slow,
      },
      caffeineOnset: parsed.caffeineOnset ?? DEFAULT_CAFFEINE_ONSET,
      totalNaps: parsed.totalNaps ?? 0,
      missionEnabled: parsed.missionEnabled ?? false,
      wakeRoutineEnabled: parsed.wakeRoutineEnabled ?? true,
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
    missionEnabled: false,
    wakeRoutineEnabled: true,
  };
  await saveSettings(migrated);
  return migrated;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

// 설정 화면 "알람 해제 미션" 토글 전용 — Settings 전체를 읽고 이 필드만 바꿔 저장한다
// (applyManualAdjustment와 동일한 read-modify-write 패턴).
export async function setMissionEnabled(enabled: boolean): Promise<void> {
  const settings = await getSettings();
  await saveSettings({ ...settings, missionEnabled: enabled });
}

// 설정 화면 "기상 루틴" 토글 전용 — setMissionEnabled와 동일한 read-modify-write 패턴.
export async function setWakeRoutineEnabled(enabled: boolean): Promise<void> {
  const settings = await getSettings();
  await saveSettings({ ...settings, wakeRoutineEnabled: enabled });
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

// 알람 화면(app/alarm.tsx)의 슬라이드/롱프레스 해제 직후 호출 — 미션이 켜져 있을 때만
// 쓰인다. 이후 useNapWatchdog의 resolveNapRoute가 같은 ActiveNap을 다시 '/alarm'으로
// 보내지 않고 '/mission'으로 넘긴다.
export async function markAlarmDismissed(): Promise<void> {
  const nap = await getActiveNap();
  if (!nap) return;
  await saveActiveNap({ ...nap, alarmDismissed: true });
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

// 기상 루틴 화면(/wake-stretch·/wake-light·/wake-water)이 밀어서 넘길 때마다 호출 —
// pendingFeedback.wakeChecklist에 해당 항목만 true로 병합해 저장한다(나머지는 기존 값
// 또는 기본 false 유지). pendingFeedback이 없으면(직접 진입 등 예외 상황) no-op —
// 화면 쪽에서 이미 홈으로 돌려보내는 가드를 따로 둔다.
export async function markWakeChecklistItem(key: keyof WakeChecklist): Promise<void> {
  const pending = await getPendingFeedback();
  if (!pending) return;
  const checklist: WakeChecklist = pending.wakeChecklist ?? { stretch: false, light: false, water: false };
  await savePendingFeedback({ ...pending, wakeChecklist: { ...checklist, [key]: true } });
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

// 히스토리 화면의 개별 기록 삭제 — completedAt이 유니크 키다(같은 화면의 FlatList
// keyExtractor와 동일하게 취급). 주변 방해가 컸던 낮잠처럼 학습/분석에 안 쓰고 싶은
// 기록을 사용자가 직접 지울 수 있게 한다(사용자 지시).
export async function deleteNapRecord(completedAt: number): Promise<void> {
  const records = await getNapRecords();
  await AsyncStorage.setItem(KEYS.napRecords, JSON.stringify(records.filter((r) => r.completedAt !== completedAt)));
}

// AI 분석 전송 동의(AI_ANALYSIS.md §6) — null은 "아직 물어본 적 없음"(최초 진입 시
// 동의 화면 노출), false는 "거부함"(재진입해도 다시 물어봄), true는 "동의함"(바로 분석
// 화면으로). 설정 화면에서 이 값을 직접 뒤집을 수 있다("재동의 가능").
export async function getAiConsent(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(KEYS.aiConsent);
  if (raw === null) return null;
  return raw === 'true';
}

export async function setAiConsent(consented: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.aiConsent, String(consented));
}

// AI 분석 목록/상세 로컬 캐시 — 서버(analyses 테이블)가 진실의 원천, 캐시는 오프라인
// 보조 열람용(AI_ANALYSIS.md §6). aiAnalysis.ts의 listAnalyses/getAnalysisDetail이
// 네트워크 요청 성공 시 여기 채워두고, 실패 시 여기서 폴백을 읽는다.
export async function getCachedAnalysisList(): Promise<AnalysisListItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.analysisListCache);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AnalysisListItem[];
  } catch {
    return [];
  }
}

export async function setCachedAnalysisList(items: AnalysisListItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.analysisListCache, JSON.stringify(items));
}

export async function getCachedAnalysisDetail(id: number): Promise<AnalysisDetail | null> {
  const raw = await AsyncStorage.getItem(KEYS.analysisDetailCache);
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, AnalysisDetail>;
    return map[String(id)] ?? null;
  } catch {
    return null;
  }
}

export async function setCachedAnalysisDetail(detail: AnalysisDetail): Promise<void> {
  const raw = await AsyncStorage.getItem(KEYS.analysisDetailCache);
  let map: Record<string, AnalysisDetail> = {};
  if (raw) {
    try {
      map = JSON.parse(raw);
    } catch {
      map = {};
    }
  }
  map[String(detail.id)] = detail;
  await AsyncStorage.setItem(KEYS.analysisDetailCache, JSON.stringify(map));
}

// 네트워크 조회 결과가 없으면(오프라인/에러) 캐시로 폴백 — 순수 함수로 분리해 목킹 없이
// 테스트한다. fetched가 null이면 캐시, 아니면 fetched(최신 서버 값)를 신뢰한다.
export function resolveAnalysisList(fetched: AnalysisListItem[] | null, cached: AnalysisListItem[]): AnalysisListItem[] {
  return fetched ?? cached;
}

export function resolveAnalysisDetail(fetched: AnalysisDetail | null, cached: AnalysisDetail | null): AnalysisDetail | null {
  return fetched ?? cached;
}

// 설정 화면 "서버 데이터 삭제" 성공 후 호출 — 서버(auth.users 및 cascade된 행)는
// aiAnalysis.requestDataDeletion()이 이미 지웠으니, 로컬에 남은 AI 관련 흔적(동의 상태·
// 분석 목록/상세 캐시)만 정리한다. NapRecord(로컬 낮잠 기록)는 서버 데이터가 아니라
// 여기서 건드리지 않는다 — 서버 삭제 이후에도 동의를 그대로 true로 남겨두면 다음 진입
// 시 "이미 동의했다"고 오판해 재동의 없이 새 익명 계정에 곧장 데이터를 보내게 된다.
export async function clearAiLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([KEYS.aiConsent, KEYS.analysisListCache, KEYS.analysisDetailCache]);
}
