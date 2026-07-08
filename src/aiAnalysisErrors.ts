// aiAnalysis.ts의 순수 부분만 분리 — supabase.ts(모듈 로드 시 env var 없으면 throw)를
// 끌어오지 않아 jest "app" 프로젝트에서 .env 세팅 없이도 바로 테스트할 수 있다.
export type AnalysisErrorCode =
  | 'unauthenticated'
  | 'not_enough_records'
  | 'insufficient_credit'
  | 'turn_limit_reached'
  | 'not_found'
  | 'network'
  | 'unknown';

export interface AnalysisError {
  code: AnalysisErrorCode;
  message: string;
}

const KNOWN_CODES: AnalysisErrorCode[] = [
  'unauthenticated',
  'not_enough_records',
  'insufficient_credit',
  'turn_limit_reached',
  'not_found',
];

// Edge Function이 보낸 { error, message } 바디를 우선 신뢰하고, 파싱이 안 되면 HTTP
// 상태코드로 대체 판정한다.
export function mapInvokeErrorToAnalysisError(
  status: number | undefined,
  body: { error?: string; message?: string } | null
): AnalysisError {
  if (body?.error && (KNOWN_CODES as string[]).includes(body.error)) {
    return { code: body.error as AnalysisErrorCode, message: body.message ?? '' };
  }
  const byStatus: Partial<Record<number, AnalysisErrorCode>> = {
    401: 'unauthenticated',
    422: 'not_enough_records',
    402: 'insufficient_credit',
    409: 'turn_limit_reached',
    404: 'not_found',
  };
  const code = (status && byStatus[status]) || 'unknown';
  return { code, message: body?.message ?? '알 수 없는 오류가 발생했다.' };
}

export function isAnalysisError(value: unknown): value is AnalysisError {
  return typeof value === 'object' && value !== null && 'code' in value;
}
