import { useEffect, useState } from 'react';

import { getAnalysisStatus } from './aiAnalysis';

export interface FreeResetStatus {
  loading: boolean;
  hasWeeklyFree: boolean | null; // null = 아직 모름(로딩 중이거나 조회 실패)
  remainingMs: number | null; // null = 무료 사용 가능(타이머 없음) 또는 아직 모름
}

const TICK_MS = 60_000; // 분 단위 갱신으로 충분(요구사항) — 초 단위 안 함.

// 402 화면/히스토리 "AI 분석" 진입점이 공유하는 카운트다운 상태. 서버가 준 시각
// 기준으로 남은 시간을 "고정"해두고, 그 뒤로는 기기의 경과 시간(델타)만 더해 틱한다 —
// 기기의 절대 시각을 신뢰하지 않는다(바꿔도 델타는 정상적으로 흐름). enabled=false면
// 아예 조회하지 않는다(동의 전 화면 등에서 불필요한 서버 호출 방지).
export function useFreeResetStatus(enabled: boolean): FreeResetStatus {
  const [loading, setLoading] = useState(enabled);
  const [hasWeeklyFree, setHasWeeklyFree] = useState<boolean | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    setLoading(true);

    getAnalysisStatus()
      .then(({ hasWeeklyFree: free, serverNowMs, nextFreeResetAtMs }) => {
        if (cancelled) return;
        setHasWeeklyFree(free);
        if (free) {
          setRemainingMs(null);
          return;
        }
        const fetchedAtDeviceMs = Date.now();
        const initialRemainingMs = nextFreeResetAtMs - serverNowMs;
        const tick = () => {
          const elapsed = Date.now() - fetchedAtDeviceMs;
          setRemainingMs(Math.max(0, initialRemainingMs - elapsed));
        };
        tick();
        interval = setInterval(tick, TICK_MS);
      })
      .catch(() => {
        if (!cancelled) {
          setHasWeeklyFree(null);
          setRemainingMs(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [enabled]);

  return { loading, hasWeeklyFree, remainingMs };
}
