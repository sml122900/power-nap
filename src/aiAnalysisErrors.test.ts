import { isAnalysisError, mapInvokeErrorToAnalysisError } from './aiAnalysisErrors';
import i18n from './i18n';

describe('mapInvokeErrorToAnalysisError', () => {
  it('바디의 error 코드를 우선 신뢰하되, message는 서버 값을 무시하고 항상 로케일 문구로 매핑한다', () => {
    // 서버 message('디버그용 영어 텍스트')를 그대로 노출하지 않는다는 게 핵심 계약 —
    // 아무 영어 문자열을 넣어도 결과 message는 항상 ko 로케일 문구여야 한다(jest.i18n.setup.js가
    // 매 테스트를 'ko'로 고정).
    const result = mapInvokeErrorToAnalysisError(402, { error: 'insufficient_credit', message: 'debug only, never shown' });
    expect(result).toEqual({ code: 'insufficient_credit', message: '이번 주 무료 분석을 사용했어요.' });
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

  it('알 수 없는 상태코드는 unknown, message는 로케일 폴백 문구', () => {
    expect(mapInvokeErrorToAnalysisError(500, null)).toEqual({ code: 'unknown', message: '알 수 없는 오류가 발생했다.' });
    expect(mapInvokeErrorToAnalysisError(undefined, null).code).toBe('unknown');
  });

  it('영어 로케일에서는 message도 영어로 나온다', async () => {
    await i18n.changeLanguage('en');
    expect(mapInvokeErrorToAnalysisError(402, null).message).toBe("You've used this week's free analysis.");
    await i18n.changeLanguage('ko');
  });
});

describe('isAnalysisError', () => {
  it('code 필드가 있는 객체만 인정한다', () => {
    expect(isAnalysisError({ code: 'network', message: '' })).toBe(true);
    expect(isAnalysisError(new Error('x'))).toBe(false);
    expect(isAnalysisError(null)).toBe(false);
  });
});
