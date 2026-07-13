// 알람 해제 미션(명언 타이핑) — BACKLOG.md "알람 해제 미션" 참고. 설정에서 토글 ON일 때만
// app/mission.tsx가 이 배열에서 문구를 뽑는다.
//
// 저작권: 전부 자체 작성(self-written) — 실존 인물의 인용구는 정확한 원문·공개 출처를
// 확인할 수 없으면 오귀속 위험이 있어 애초에 배제했다(불확실하면 자체 작성 원칙).
// 낮잠·휴식·재충전·집중 테마, 비몽사몽 상태에서도 오래 안 걸리게 20자 내외로 짧게 썼다.
// ko/en은 서로 직역이 아니라 각 언어에서 자연스러운 독립 문구다(짧고 자연스러운 게
// 우선 — UI 문자열처럼 1:1 대응을 요구하는 i18n 키가 아니라 자유롭게 작성).
//
// 배열 순서는 의미 없다 — "3회 실패 시 더 짧은 명언 제시"(pickShorterQuote)는 매번
// 길이로 다시 필터링해서 고르므로 미리 정렬해둘 필요가 없다.
//
// AsyncStorage는 이 파일 최상단에서 정적으로 import한다(i18n.ts/supabase.ts의 지연
// import 패턴과 다름) — 이 파일의 유일한 테스트 파일(missionQuotes.test.ts)이 이미
// getMissionQuotes/setMissionQuotes를 테스트하느라 AsyncStorage를 jest.mock하고
// 있어 지연 로딩으로 보호할 "순수 함수만 쓰는 테스트"가 없다. 게다가 `await import(...)`
// 동적 import는 jest-expo의 metro caller 설정상 커밋 시점에 CommonJS로 안 바뀌어
// "--experimental-vm-modules 없이 호출됨" 에러를 낸다(직접 재현 확인) — 정적 import가
// 더 단순하고 이 버그를 피한다.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MISSION_QUOTES: Record<'ko' | 'en', string[]> = {
  ko: [
    '잘 쉬었다',
    '이제 일어나자',
    '충전 완료',
    '눈을 뜨자',
    '몸이 가볍다',
    '오늘도 힘내자',
    '집중할 시간',
    '휴식은 끝났다',
    '다시 시작하자',
    '맑은 정신으로',
    '한숨 돌렸다',
    '천천히 일어나자',
    '몸과 마음을 깨우자',
    '짧은 휴식, 긴 집중',
    '쉼표 뒤에 마침표',
    '깨어난 나를 응원해',
    '오늘의 나를 다시 켜자',
    '잠깐의 쉼이 하루를 바꾼다',
  ],
  en: [
    'Rest is over',
    'Time to rise',
    'Fully charged',
    'Open your eyes',
    'Body feels light',
    'Wake up and go',
    'Focus starts now',
    'Nap complete',
    'Back in action',
    'Clear mind ahead',
    'Rise and shine',
    'Slowly get up',
    'Recharge complete',
    'Focus mode: on',
    'Ready to begin again',
    'Stay sharp, stay calm',
    'Small break, big gain',
    'New energy, new focus',
  ],
};

// 공백류(스페이스/탭/줄바꿈)와 구두점을 제거하고 소문자로 맞춘 뒤 비교한다 — 오타 판정이
// 아니라 "같은 문장을 쳤는지"만 보는 관대한 대조. \p{P}(유니코드 구두점 카테고리)로
// 한글/영문 구두점을 한 번에 처리한다(Hermes는 SDK 57 기준 유니코드 속성 이스케이프 지원).
export function normalizeMissionInput(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}]/gu, '');
}

export function isMissionInputCorrect(input: string, quote: string): boolean {
  return normalizeMissionInput(input) === normalizeMissionInput(quote);
}

// "3회 실패 시 다른(더 짧은) 명언 제시" — 실패한 문구보다 짧은 것들 중에서 무작위로
// 고른다(같은 문구가 다시 나오지 않게, 더 짧아졌다는 걸 보장). 짧은 쪽에 후보가
// 없으면(이미 가장 짧은 문구였던 경우) 전체에서 현재 문구만 제외하고 고른다.
// quotes는 호출부(app/mission.tsx)가 getMissionQuotes()로 미리 로드해 넘긴다 — 사용자가
// 설정에서 커스텀한 목록일 수도, 기본 MISSION_QUOTES일 수도 있어 이 함수는 어느 쪽인지
// 몰라도 된다(순수 함수 유지).
export function pickShorterQuote(quotes: string[], currentQuote: string, random: () => number = Math.random): string {
  const shorter = quotes.filter((q) => q.length < currentQuote.length);
  const pool = shorter.length > 0 ? shorter : quotes.filter((q) => q !== currentQuote);
  if (pool.length === 0) return currentQuote;
  return pool[Math.floor(random() * pool.length)];
}

export function pickRandomQuote(quotes: string[], random: () => number = Math.random): string {
  return quotes[Math.floor(random() * quotes.length)];
}

// 설정 화면에서 편집한 커스텀 명언 목록 — 언어별로 저장, 값이 없으면 MISSION_QUOTES
// 기본값을 쓴다.
const QUOTES_STORAGE_KEY = 'powernap:missionQuotesOverride';

type QuoteOverrides = Partial<Record<'ko' | 'en', string[]>>;

export async function getMissionQuotes(locale: 'ko' | 'en'): Promise<string[]> {
  const raw = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
  if (!raw) return MISSION_QUOTES[locale];
  try {
    const overrides = JSON.parse(raw) as QuoteOverrides;
    const custom = overrides[locale];
    return custom && custom.length > 0 ? custom : MISSION_QUOTES[locale];
  } catch {
    return MISSION_QUOTES[locale];
  }
}

export async function setMissionQuotes(locale: 'ko' | 'en', quotes: string[]): Promise<void> {
  const raw = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
  let overrides: QuoteOverrides = {};
  if (raw) {
    try {
      overrides = JSON.parse(raw) as QuoteOverrides;
    } catch {
      overrides = {};
    }
  }
  overrides[locale] = quotes;
  await AsyncStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(overrides));
}
