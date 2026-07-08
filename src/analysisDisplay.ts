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

// "2일 14시간 32분" — 다음 무료 분석까지 남은 시간. 초 단위 없음(분 갱신으로 충분).
// 최고 단위가 0이 아니면 그 아래 단위도 항상 같이 보여준다(폭이 들쭉날쭉하지 않게) —
// 예: "1일 0시간 5분"은 보여주지만 "0시간 5분"은 그냥 "5분"으로.
export function formatFreeResetCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '곧';
  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}일`);
  if (days > 0 || hours > 0) parts.push(`${hours}시간`);
  parts.push(`${minutes}분`);
  return parts.join(' ');
}
