// Phase B — AI_ANALYSIS.md §5/§6 Edge Function. Claude 호출은 성공한 뒤에만 크레딧을
// 차감한다(record_analysis_result RPC가 credit_events insert + analyses insert를 한
// 트랜잭션으로 묶어 처리 — migrations/0002 주석 참고). 실패 시 크레딧 미차감이 자동으로
// 보장된다(보상 트랜잭션 불필요).
import Anthropic from 'npm:@anthropic-ai/sdk@^0.110.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@^0.110.0/helpers/zod';
import { createClient } from 'npm:@supabase/supabase-js@^2.110.1';

import { AnalysisReportSchema, buildAnalysisUserMessage, buildSystemPrompt, EFFORT, MAX_TOKENS, MODEL } from './prompts/analysis-v2.ts';

const MIN_RECORDS = 5;
const MAX_FOLLOWUP_TURNS = 3;
const FOLLOWUP_MAX_TOKENS = 1024;
// 토큰 비용 방어선 — records_snapshot이 프롬프트에 통째로 들어가므로 무한정 커지는 걸
// 막는다. 클라이언트가 이미 기간 필터(AI_ANALYSIS.md §2)로 줄여서 보내는 게 정상 경로라
// 이건 안전망일 뿐 — 초과분은 에러 없이 조용히 버리고 최신순 50개만 쓴다.
const MAX_RECORDS = 50;

// 플랫폼이 자동 주입하는 이름이 신형 키 체계 롤아웃 단계에 따라 다르다(단일 문자열
// SUPABASE_SECRET_KEY, 또는 이름별 JSON SUPABASE_SECRET_KEYS) — 셋 다 시도한다.
// SUPABASE_ 접두사는 플랫폼 예약어라 커스텀 secrets set으로 직접 넣을 수 없다(자동 주입 전용).
function resolveSupabaseSecretKey(): string {
  const single = Deno.env.get('SUPABASE_SECRET_KEY');
  if (single) return single;

  const keyed = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keyed) {
    const parsed = JSON.parse(keyed) as Record<string, string>;
    const value = parsed.default ?? Object.values(parsed)[0];
    if (value) return value;
  }

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  throw new Error('SUPABASE_SECRET_KEY(S)를 찾을 수 없다 — 플랫폼 자동 주입 확인 필요');
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseSecretKey = resolveSupabaseSecretKey();
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')!;

const admin = createClient(supabaseUrl, supabaseSecretKey);
const anthropic = new Anthropic({ apiKey: anthropicApiKey });

const DAY_MS = 24 * 60 * 60 * 1000;

// has_weekly_free()가 Postgres에서 쓰는 것과 동일한 "이번 주 월요일 00:00 KST" 계산을
// Deno 쪽에도 둔다(analyze.test.ts의 mondayKstBoundaryUtc와 같은 공식, 이미 DB 함수와
// 일치함을 통합 테스트로 검증됨) — 이 값 자체가 Deno 서버 시각 기준이라 기기 시각 조작과
// 무관하다.
function mondayKstBoundaryUtc(nowMs: number): number {
  const kst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun..6=Sat — kst가 이미 +9h shift된 시각이라 UTC getter로 읽어도 KST 벽시계 값
  const diffToMonday = day === 0 ? 6 : day - 1;
  const kstMidnightFields = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - diffToMonday, 0, 0, 0, 0);
  return kstMidnightFields - 9 * 60 * 60 * 1000;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!jwt) return jsonResponse(401, { error: 'unauthenticated', message: '인증 토큰이 없다.' });

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    return jsonResponse(401, { error: 'unauthenticated', message: '유효하지 않은 세션이다.' });
  }
  return { userId: data.user.id };
}

// 실패 시 크레딧 미차감을 위해 이 함수는 절대 credit_events/analyses를 건드리지 않는다 —
// 호출부에서 성공한 결과만 record_analysis_result로 넘긴다.
async function callAnalysis(
  records: unknown[],
  settings: { latency: { fast: number; slow: number }; caffeineOnset: number },
  locale: string,
) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT, format: zodOutputFormat(AnalysisReportSchema, 'analysis_report') },
    system: buildSystemPrompt(locale),
    messages: [{ role: 'user' as const, content: buildAnalysisUserMessage(records, settings) }],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.parse(params);
      if (!response.parsed_output) throw new Error('parsed_output is null');
      return { report: response.parsed_output, tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens };
    } catch (err) {
      if (attempt === 1) throw err; // 1회 재시도 후에도 실패하면 상위로 전파(크레딧 미차감)
    }
  }
  throw new Error('unreachable');
}

// 무료 분석 잔여 상태 — history.tsx 진입점/402 화면의 카운트다운 표시용. NapRecord를
// 전혀 안 받는 가벼운 조회라 Claude 호출 없음(비용 없음). has_weekly_free는 service_role
// 전용으로 잠가둬서(CLAUDE.md 지뢰 목록) 클라이언트가 직접 RPC를 못 부른다 — 이 엔드포인트가
// 유일한 경로.
async function handleStatus(userId: string): Promise<Response> {
  const { data: hasWeeklyFree, error } = await admin.rpc('has_weekly_free', { p_user_id: userId });
  if (error) return jsonResponse(500, { error: 'server_error', message: error.message });

  const serverNowMs = Date.now();
  const nextFreeResetAtMs = mondayKstBoundaryUtc(serverNowMs) + 7 * DAY_MS;

  return jsonResponse(200, { hasWeeklyFree, serverNowMs, nextFreeResetAtMs });
}

async function handleAnalyze(userId: string, req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const records = body?.records;
  const settings = body?.settings;
  const locale = body?.locale ?? 'ko';
  if (!Array.isArray(records) || !settings?.latency || typeof settings.caffeineOnset !== 'number') {
    return jsonResponse(422, { error: 'invalid_input', message: 'records/settings 형식이 올바르지 않다.' });
  }
  if (records.length < MIN_RECORDS) {
    return jsonResponse(422, { error: 'not_enough_records', message: `낮잠 기록이 ${MIN_RECORDS}개 이상 필요하다.` });
  }

  const cappedRecords = [...records]
    .sort((a: { completedAt?: number }, b: { completedAt?: number }) => (b?.completedAt ?? 0) - (a?.completedAt ?? 0))
    .slice(0, MAX_RECORDS);

  const { data: freeAvailable, error: freeCheckError } = await admin.rpc('has_weekly_free', { p_user_id: userId });
  if (freeCheckError) return jsonResponse(500, { error: 'server_error', message: freeCheckError.message });

  let chargeReason: 'weekly_free' | 'analysis';
  if (freeAvailable) {
    chargeReason = 'weekly_free';
  } else {
    const { data: creditsRow, error: creditsError } = await admin.from('credits').select('balance').eq('user_id', userId).single();
    if (creditsError) return jsonResponse(500, { error: 'server_error', message: creditsError.message });
    if (creditsRow.balance <= 0) {
      return jsonResponse(402, {
        error: 'insufficient_credit',
        message: '이번 주 무료 분석을 사용했다. 추가 분석은 1,000원이다.',
      });
    }
    chargeReason = 'analysis';
  }

  let result: Awaited<ReturnType<typeof callAnalysis>>;
  try {
    result = await callAnalysis(cappedRecords, settings, locale);
  } catch (err) {
    return jsonResponse(500, { error: 'analysis_failed', message: '분석에 실패했다. 다시 시도해달라.', detail: String(err) });
  }

  const { data: analysisId, error: recordError } = await admin.rpc('record_analysis_result', {
    p_user_id: userId,
    p_charge_reason: chargeReason,
    p_records_snapshot: cappedRecords,
    p_report: result.report,
    p_model: MODEL,
    p_tokens_in: result.tokensIn,
    p_tokens_out: result.tokensOut,
  });
  if (recordError) {
    // 극히 드문 동시요청 레이스(예: 잔액 1개인 상태에서 같은 유저가 거의 동시에 2번 요청) —
    // Claude 호출 비용은 이미 썼지만 크레딧은 차감되지 않았다(레코드 자체가 롤백됨).
    return jsonResponse(402, { error: 'insufficient_credit', message: '크레딧이 부족하다.' });
  }

  return jsonResponse(200, {
    analysisId,
    report: result.report,
    turnsRemaining: MAX_FOLLOWUP_TURNS,
    chargeReason,
    recordsUsed: cappedRecords.length,
  });
}

async function handleFollowup(userId: string, analysisId: number, req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const question = body?.question;
  const locale = body?.locale ?? 'ko';
  if (typeof question !== 'string' || !question.trim()) {
    return jsonResponse(422, { error: 'invalid_input', message: 'question이 필요하다.' });
  }

  const { data: analysis, error: fetchError } = await admin
    .from('analyses')
    .select('id, user_id, report, turns, followup_turns_used')
    .eq('id', analysisId)
    .maybeSingle();
  if (fetchError) return jsonResponse(500, { error: 'server_error', message: fetchError.message });
  if (!analysis || analysis.user_id !== userId) {
    return jsonResponse(404, { error: 'not_found', message: '분석 기록을 찾을 수 없다.' });
  }
  if (analysis.followup_turns_used >= MAX_FOLLOWUP_TURNS) {
    return jsonResponse(409, { error: 'turn_limit_reached', message: '후속 질문 3턴을 모두 사용했다.' });
  }

  const priorTurns = (analysis.turns as { role: 'user' | 'assistant'; content: string }[]) ?? [];
  const messages: Anthropic.MessageParam[] = [
    { role: 'assistant', content: JSON.stringify(analysis.report) },
    ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user', content: question },
  ];

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: FOLLOWUP_MAX_TOKENS,
      output_config: { effort: EFFORT },
      system: buildSystemPrompt(locale),
      messages,
    });
  } catch (err) {
    return jsonResponse(500, { error: 'followup_failed', message: '후속 질문 처리에 실패했다.', detail: String(err) });
  }

  const answerText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const { data: turnsUsed, error: appendError } = await admin.rpc('append_followup_turn', {
    p_analysis_id: analysisId,
    p_user_id: userId,
    p_new_turns: [
      { role: 'user', content: question },
      { role: 'assistant', content: answerText },
    ],
    p_tokens_in: response.usage.input_tokens,
    p_tokens_out: response.usage.output_tokens,
  });
  if (appendError) {
    return jsonResponse(409, { error: 'turn_limit_reached', message: '후속 질문 3턴을 모두 사용했다.' });
  }

  return jsonResponse(200, { answer: answerText, turnsUsed, turnsRemaining: MAX_FOLLOWUP_TURNS - turnsUsed });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const body = await req.clone().json().catch(() => null);
  if (body?.mode === 'status') {
    return handleStatus(auth.userId);
  }
  if (body?.analysisId) {
    return handleFollowup(auth.userId, body.analysisId, req);
  }
  return handleAnalyze(auth.userId, req);
});
