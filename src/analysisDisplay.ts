import { formatKoreanTime } from './format';
import type { AnalysisListItem, FollowupTurn } from './analysisTypes';

export interface AnalysisListLabel {
  id: number;
  requestedAt: string;
  label: string;
}

// "7월 8일 분석" — 같은 날짜에 여러 건이면 시각을 병기해 구분한다("7월 8일 분석 (오후 2:30)").
export function formatAnalysisListLabels(items: AnalysisListItem[]): AnalysisListLabel[] {
  const dateKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = dateKey(item.requestedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return items.map((item) => {
    const d = new Date(item.requestedAt);
    const base = `${d.getMonth() + 1}월 ${d.getDate()}일 분석`;
    const sameDayCount = counts.get(dateKey(item.requestedAt)) ?? 0;
    const label = sameDayCount > 1 ? `${base} (${formatKoreanTime(d)})` : base;
    return { id: item.id, requestedAt: item.requestedAt, label };
  });
}

export interface FollowupExchange {
  question: string;
  answer: string;
}

// 저장된 turns([user, assistant, user, assistant, ...])를 화면이 쓰는 Q&A 쌍으로 묶는다.
// append_followup_turn RPC가 항상 [user, assistant] 순서로 2개씩 append하므로 안전하다.
export function turnsToExchanges(turns: FollowupTurn[]): FollowupExchange[] {
  const exchanges: FollowupExchange[] = [];
  for (let i = 0; i + 1 < turns.length; i += 2) {
    if (turns[i].role === 'user' && turns[i + 1].role === 'assistant') {
      exchanges.push({ question: turns[i].content, answer: turns[i + 1].content });
    }
  }
  return exchanges;
}
