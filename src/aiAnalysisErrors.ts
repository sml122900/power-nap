// aiAnalysis.ts의 순수 부분만 분리 — supabase.ts(모듈 로드 시 env var 없으면 throw)를
// 끌어오지 않아 jest "app" 프로젝트에서 .env 세팅 없이도 바로 테스트할 수 있다.
// i18n.ts는 순수 함수 import라 안전(AsyncStorage는 지연 import라 여기서도 마찬가지로 안전).
import i18n from './i18n';

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

// index.ts의 `message` 필드는 서버 로그/디버그 전용 영어 텍스트라 사용자에게 그대로
// 보여주지 않는다(index.ts 상단 주석 "에러 응답 규칙" 참고) — `error` 코드만 신뢰하고,
// 실제 표시 문구는 여기서 locales/*.json으로 직접 매핑한다. Record<AnalysisErrorCode, string>
// 타입이라 새 코드를 추가하면 여기 매핑을 안 채웠을 때 TS가 컴파일 에러로 잡아준다.
const SERVER_ERROR_MESSAGE_KEY: Record<AnalysisErrorCode, string> = {
  unauthenticated: 'analysisReport:serverError.unauthenticated',
  not_enough_records: 'analysisReport:serverError.notEnoughRecords',
  insufficient_credit: 'analysisReport:insufficientCreditMessage',
  turn_limit_reached: 'analysisReport:serverError.turnLimitReached',
  not_found: 'analysisReport:serverError.notFound',
  network: 'analysisReport:networkError',
  unknown: 'analysisReport:unknownError',
};

// Edge Function이 보낸 { error, message } 바디에서 `error` 코드만 신뢰하고, 파싱이 안 되면
// HTTP 상태코드로 대체 판정한다. `message`는 절대 안 쓴다(위 SERVER_ERROR_MESSAGE_KEY 참고).
export function mapInvokeErrorToAnalysisError(
  status: number | undefined,
  body: { error?: string; message?: string } | null
): AnalysisError {
  if (body?.error && (KNOWN_CODES as string[]).includes(body.error)) {
    const code = body.error as AnalysisErrorCode;
    return { code, message: i18n.t(SERVER_ERROR_MESSAGE_KEY[code]) };
  }
  const byStatus: Partial<Record<number, AnalysisErrorCode>> = {
    401: 'unauthenticated',
    422: 'not_enough_records',
    402: 'insufficient_credit',
    409: 'turn_limit_reached',
    404: 'not_found',
  };
  const code = (status && byStatus[status]) || 'unknown';
  return { code, message: i18n.t(SERVER_ERROR_MESSAGE_KEY[code]) };
}

export function isAnalysisError(value: unknown): value is AnalysisError {
  return typeof value === 'object' && value !== null && 'code' in value;
}
