// AI 분석 응답/이력 타입 — store.ts(로컬 캐시)와 aiAnalysis.ts(네트워크) 양쪽이 공유한다.
// 순수 타입만 두는 이유: aiAnalysis.ts는 supabase.ts(모듈 로드 시 env var 없으면 throw)를
// 끌어오는데, store.ts는 그런 부작용이 없어야 jest "app" 프로젝트에서 .env 없이도 테스트된다.
export interface AnalysisReport {
  latencyAdjust: { fast: number; slow: number } | null;
  caffeineOnsetAdjust: number | null;
  summary: string;
  advice: string[];
  confidence: 'high' | 'low';
}

export interface FollowupTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnalysisListItem {
  id: number;
  requestedAt: string; // ISO 문자열(서버 completedAt 아님 — analyses.requested_at)
}

export interface AnalysisDetail extends AnalysisListItem {
  report: AnalysisReport;
  turns: FollowupTurn[];
  followupTurnsUsed: number;
  turnsRemaining: number;
  recordsUsed: number;
}

// 분석 1회 = 리포트 1개 + 후속 질문 3턴(AI_ANALYSIS.md §2). Edge Function 쪽 상수와
// 값만 일치시켜 둔다(Deno/Node 경계라 실제 공유는 못 함).
export const MAX_FOLLOWUP_TURNS = 3;
