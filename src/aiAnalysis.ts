// AI 분석 API 클라이언트 — AI_ANALYSIS.md §6, supabase/functions/analyze 대응.
// 순수 에러 매핑/타입은 aiAnalysisErrors.ts·analysisTypes.ts에 분리(테스트가 supabase.ts의
// env var 요구를 안 타게).
import { FunctionsHttpError } from '@supabase/supabase-js';

import i18n from './i18n';
import {
  getCachedAnalysisDetail,
  getCachedAnalysisList,
  resolveAnalysisDetail,
  resolveAnalysisList,
  setCachedAnalysisDetail,
  setCachedAnalysisList,
  type NapRecord,
  type Settings,
} from './store';
import { ensureAnonymousSession, getSupabase } from './supabase';
import { mapInvokeErrorToAnalysisError, type AnalysisError } from './aiAnalysisErrors';
import { MAX_FOLLOWUP_TURNS, type AnalysisDetail, type AnalysisListItem, type AnalysisReport } from './analysisTypes';

export type { AnalysisError, AnalysisErrorCode } from './aiAnalysisErrors';
export { isAnalysisError, mapInvokeErrorToAnalysisError } from './aiAnalysisErrors';
export type { AnalysisDetail, AnalysisListItem, AnalysisReport, FollowupTurn } from './analysisTypes';
export { MAX_FOLLOWUP_TURNS } from './analysisTypes';

export interface AnalysisResult {
  analysisId: number;
  report: AnalysisReport;
  turnsRemaining: number;
  chargeReason: 'weekly_free' | 'analysis';
  recordsUsed: number;
}

export interface FollowupResult {
  answer: string;
  turnsUsed: number;
  turnsRemaining: number;
}

export interface AnalysisStatus {
  hasWeeklyFree: boolean;
  serverNowMs: number;
  nextFreeResetAtMs: number;
}

async function invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  let session;
  try {
    session = await ensureAnonymousSession();
  } catch {
    throw { code: 'network', message: i18n.t('analysisReport:networkError') } satisfies AnalysisError;
  }

  const { data, error } = await getSupabase().functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const parsedBody = await error.context.json().catch(() => null);
      throw mapInvokeErrorToAnalysisError(error.context.status, parsedBody);
    }
    throw { code: 'network', message: i18n.t('analysisReport:networkError') } satisfies AnalysisError;
  }
  return data as T;
}

// locale은 현재 앱 언어(i18n.language, 'ko'|'en')를 그대로 보낸다 — Edge Function의
// buildSystemPrompt(locale)이 같은 코드를 그대로 받아 출력 언어를 정한다(analysis-v2.ts).
export async function requestAnalysis(records: NapRecord[], settings: Settings): Promise<AnalysisResult> {
  return invoke<AnalysisResult>('analyze', {
    records,
    settings: { latency: settings.latency, caffeineOnset: settings.caffeineOnset },
    locale: i18n.language,
  });
}

export async function requestFollowup(analysisId: number, question: string): Promise<FollowupResult> {
  return invoke<FollowupResult>('analyze', { analysisId, question, locale: i18n.language });
}

// 무료 분석 잔여 상태(카운트다운용) — has_weekly_free RPC는 service_role 전용으로 잠겨
// 있어(migrations/0003) 클라이언트가 직접 못 부른다, 이 경로가 유일한 조회 수단.
export async function getAnalysisStatus(): Promise<AnalysisStatus> {
  return invoke<AnalysisStatus>('analyze', { mode: 'status' });
}

// 설정 화면 "서버 데이터 삭제" — supabase/functions/delete-my-data가 auth.users 행을
// 지우면 FK cascade로 credits/credit_events/analyses/public.users까지 전부 함께
// 삭제된다(Edge Function 상단 주석 참고). 성공해도 로컬 낮잠 기록(NapRecord)은 건드리지
// 않는다 — 이 함수는 서버 데이터 삭제만 담당, 로컬 상태 초기화는 호출부(설정 화면)가
// store.clearAiLocalData()로 별도 처리한다.
export async function requestDataDeletion(): Promise<void> {
  await invoke<{ deleted: true }>('delete-my-data', {});
}

// 삭제 확인 다이얼로그에 "남은 이용권 n회가 함께 삭제됩니다" 경고를 넣기 위한 조회.
// credits 테이블 RLS("본인 행만 read")로 직접 조회 — Edge Function을 거칠 필요 없다
// (listAnalyses와 동일 패턴). 실패(오프라인 등)하면 null — 호출부는 경고 없이 진행한다
// (삭제 자체를 막을 이유는 아니라서 fail-open).
export async function getCreditBalance(): Promise<number | null> {
  try {
    await ensureAnonymousSession();
  } catch {
    return null;
  }
  const { data, error } = await getSupabase().from('credits').select('balance').maybeSingle();
  if (error || !data) return null;
  return data.balance as number;
}

// 지난 분석 목록 — analyses 테이블 RLS(본인 행만)로 직접 조회한다(Edge Function 안 거침,
// 읽기 전용이라 RLS만으로 충분). 실패(오프라인 등) 시 로컬 캐시로 폴백.
export async function listAnalyses(): Promise<AnalysisListItem[]> {
  const cached = await getCachedAnalysisList();
  try {
    await ensureAnonymousSession();
  } catch {
    return resolveAnalysisList(null, cached);
  }

  const { data, error } = await getSupabase()
    .from('analyses')
    .select('id, requested_at, locale')
    .order('requested_at', { ascending: false });
  if (error || !data) {
    return resolveAnalysisList(null, cached);
  }

  const items: AnalysisListItem[] = data.map((row) => ({
    id: row.id,
    requestedAt: row.requested_at,
    locale: row.locale,
  }));
  await setCachedAnalysisList(items);
  return items;
}

export async function getAnalysisDetail(id: number): Promise<AnalysisDetail | null> {
  const cached = await getCachedAnalysisDetail(id);
  try {
    await ensureAnonymousSession();
  } catch {
    return resolveAnalysisDetail(null, cached);
  }

  const { data, error } = await getSupabase()
    .from('analyses')
    .select('id, requested_at, report, turns, followup_turns_used, records_snapshot, locale')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return resolveAnalysisDetail(null, cached);
  }

  const detail: AnalysisDetail = {
    id: data.id,
    requestedAt: data.requested_at,
    report: data.report as AnalysisReport,
    turns: data.turns ?? [],
    followupTurnsUsed: data.followup_turns_used,
    turnsRemaining: Math.max(0, MAX_FOLLOWUP_TURNS - data.followup_turns_used),
    recordsUsed: Array.isArray(data.records_snapshot) ? data.records_snapshot.length : 0,
    locale: data.locale,
  };
  await setCachedAnalysisDetail(detail);
  return detail;
}
