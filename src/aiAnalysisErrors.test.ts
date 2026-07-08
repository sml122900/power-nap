import { isAnalysisError, mapInvokeErrorToAnalysisError } from './aiAnalysisErrors';

describe('mapInvokeErrorToAnalysisError', () => {
  it('바디의 error 코드를 우선 신뢰한다(402여도 바디가 있으면 그대로)', () => {
    const result = mapInvokeErrorToAnalysisError(402, { error: 'insufficient_credit', message: '무료 소진' });
    expect(result).toEqual({ code: 'insufficient_credit', message: '무료 소진' });
  });

  it('바디가 없으면 402 → insufficient_credit로 판정(결제 안내 분기)', () => {
    const result = mapInvokeErrorToAnalysisError(402, null);
    expect(result.code).toBe('insufficient_credit');
  });

  it('401 → unauthenticated, 422 → not_enough_records, 409 → turn_limit_reached', () => {
    expect(mapInvokeErrorToAnalysisError(401, null).code).toBe('unauthenticated');
    expect(mapInvokeErrorToAnalysisError(422, null).code).toBe('not_enough_records');
    expect(mapInvokeErrorToAnalysisError(409, null).code).toBe('turn_limit_reached');
  });

  it('알 수 없는 상태코드는 unknown', () => {
    expect(mapInvokeErrorToAnalysisError(500, null).code).toBe('unknown');
    expect(mapInvokeErrorToAnalysisError(undefined, null).code).toBe('unknown');
  });
});

describe('isAnalysisError', () => {
  it('code 필드가 있는 객체만 인정한다', () => {
    expect(isAnalysisError({ code: 'network', message: '' })).toBe(true);
    expect(isAnalysisError(new Error('x'))).toBe(false);
    expect(isAnalysisError(null)).toBe(false);
  });
});
