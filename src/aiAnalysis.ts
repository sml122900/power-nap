// AI 분석 API 클라이언트 — AI_ANALYSIS.md §6, supabase/functions/analyze 대응.
// 순수 에러 매핑은 aiAnalysisErrors.ts에 분리(테스트가 supabase.ts의 env var 요구를 안 타게).
import { FunctionsHttpError } from '@supabase/supabase-js';

import { ensureAnonymousSession, supabase } from './supabase';
import type { NapRecord, Settings } from './store';
import { mapInvokeErrorToAnalysisError, type AnalysisError } from './aiAnalysisErrors';

export type { AnalysisError, AnalysisErrorCode } from './aiAnalysisErrors';
export { isAnalysisError, mapInvokeErrorToAnalysisError } from './aiAnalysisErrors';

export interface AnalysisReport {
  latencyAdjust: { fast: number; slow: number } | null;
  caffeineOnsetAdjust: number | null;
  summary: string;
  advice: string[];
  confidence: 'high' | 'low';
}

export interface AnalysisResult {
  analysisId: number;
  report: AnalysisReport;
  turnsRemaining: number;
  chargeReason: 'weekly_free' | 'analysis';
}

export interface FollowupResult {
  answer: string;
  turnsUsed: number;
  turnsRemaining: number;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  let session;
  try {
    session = await ensureAnonymousSession();
  } catch {
    throw { code: 'network', message: '네트워크 연결을 확인해달라.' } satisfies AnalysisError;
  }

  const { data, error } = await supabase.functions.invoke('analyze', {
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
