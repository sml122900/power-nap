// AI 분석 API 클라이언트 — AI_ANALYSIS.md §6, supabase/functions/analyze 대응.
// 순수 에러 매핑/타입은 aiAnalysisErrors.ts·analysisTypes.ts에 분리(테스트가 supabase.ts의
// env var 요구를 안 타게).
import { FunctionsHttpError } from '@supabase/supabase-js';

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

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  let session;
  try {
    session = await ensureAnonymousSession();
  } catch {
    throw { code: 'network', message: '네트워크 연결을 확인해달라.' } satisfies AnalysisError;
  }

  const { data, error } = await getSupabase().functions.invoke('analyze', {
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
    throw { code: 'network', message: '네트워크 연결을 확인해달라.' } satisfies AnalysisError;
  }
  return data as T;
}

export async function requestAnalysis(records: NapRecord[], settings: Settings): Promise<AnalysisResult> {
  return invoke<AnalysisResult>({
    records,
    settings: { latency: settings.latency, caffeineOnset: settings.caffeineOnset },
  });
}

export async function requestFollowup(analysisId: number, question: string): Promise<FollowupResult> {
  return invoke<FollowupResult>({ analysisId, question });
}

// 무료 분석 잔여 상태(카운트다운용) — has_weekly_free RPC는 service_role 전용으로 잠겨
// 있어(migrations/0003) 클라이언트가 직접 못 부른다, 이 경로가 유일한 조회 수단.
export async function getAnalysisStatus(): Promise<AnalysisStatus> {
  return invoke<AnalysisStatus>({ mode: 'status' });
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
    .select('id, requested_at')
    .order('requested_at', { ascending: false });
  if (error || !data) {
    return resolveAnalysisList(null, cached);
  }

  const items: AnalysisListItem[] = data.map((row) => ({ id: row.id, requestedAt: row.requested_at }));
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
    .select('id, requested_at, report, turns, followup_turns_used, records_snapshot')
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
  };
  await setCachedAnalysisDetail(detail);
  return detail;
}
