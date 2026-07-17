// 알람 해제 미션(명언 타이핑) — BACKLOG.md "알람 해제 미션" 참고. 설정에서 토글 ON일 때만
// app/mission.tsx가 이 배열에서 문구를 뽑는다.
//
// 각 명언은 { text, author } — text만 타이핑 정답 판정 대상이고 author는 화면에 표시만
// 한다(사용자 지시로 처음부터 분리해둔 구조).
// ko/en은 서로 직역이 아니라 각 언어에서 통용되는 독립 문구다(짧고 자연스러운 게
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

export interface MissionQuote {
  text: string;
  author: string;
}

// 원전(에디슨 인터뷰·Harper's Monthly 1932·프랭클린 Poor Richard's Almanack·
// 니체 우상의 황혼/차라투스트라·아인슈타인 서한(1952)·플라톤 변론·햄릿·
// 톨스토이·괴테 좌우명·논어·도덕경·헬렌 켈러 Optimism·세네카)은 모두 공유 저작물.
//
// 영어가 원문인 것(에디슨·프랭클린·켈러·아인슈타인·셰익스피어)은 원문 그대로,
// 나머지는 기존 번역문이 번역자의 저작물이므로 직접 옮긴 것 —
// 시중 번역을 가져오지 말 것.
//
// ⚠️ 이 영역은 오귀속이 매우 흔하다. 널리 도는 가짜 예:
//   '천천히 가도 멈추지만 마라'(공자 아님)
//   '20년 후 하지 않은 일을 후회한다'(마크 트웨인 아님)
//   '성공은 최종적이지 않다'(처칠 아님)
//   '변화가 되어라'(간디 아님)
//   '나무 벨 시간에 도끼를 갈겠다'(링컨 아님)
//   아인슈타인 명언 다수
// 추가 시 원전 소재가 확인된 것만. 현대 인물은 저작권 때문에 금지.
export const MISSION_QUOTES: Record<'ko' | 'en', MissionQuote[]> = {
  ko: [
    { text: '천재는 1%의 영감과 99%의 노력이다', author: '에디슨' },
    { text: '확실한 성공법은 한 번 더 해보는 것이다', author: '에디슨' },
    { text: '오늘 할 수 있는 일을 내일로 미루지 마라', author: '벤저민 프랭클린' },
    { text: '삶을 사랑하는가? 그렇다면 시간을 낭비하지 마라', author: '벤저민 프랭클린' },
    { text: '나를 죽이지 못하는 것은 나를 강하게 만든다', author: '니체' },
    { text: '왜 살아야 하는지 아는 사람은 어떻게든 견딘다', author: '니체' },
    { text: '인생은 자전거와 같다, 계속 나아가야 넘어지지 않는다', author: '아인슈타인' },
    { text: '나는 특별한 재능이 없다, 다만 열정적으로 궁금해할 뿐이다', author: '아인슈타인' },
    { text: '반성하지 않는 삶은 살 가치가 없다', author: '소크라테스' },
    { text: '무엇보다 너 자신에게 진실하라', author: '셰익스피어' },
    { text: '모두 세상을 바꾸려 하지만 자신을 바꾸려 하지는 않는다', author: '톨스토이' },
    { text: '서두르지 말되 쉬지도 마라', author: '괴테' },
    { text: '잘못을 고치지 않는 것, 그것이 진짜 잘못이다', author: '공자' },
    { text: '아는 것을 안다 하고, 모르는 것을 모른다 하라', author: '공자' },
    { text: '배우기만 하고 생각하지 않으면 얻는 게 없다', author: '공자' },
    { text: '천 리 길도 한 걸음에서 시작된다', author: '노자' },
    { text: '남을 아는 것은 지혜, 자신을 아는 것은 밝음이다', author: '노자' },
    { text: '낙관은 성취로 이끄는 믿음이다', author: '헬렌 켈러' },
    { text: '혼자서는 적게, 함께라면 많이 이룬다', author: '헬렌 켈러' },
    { text: '삶이 짧은 게 아니라 우리가 낭비하는 것이다', author: '세네카' },
  ],
  en: [
    { text: 'Genius is one percent inspiration and ninety-nine percent perspiration.', author: 'Thomas Edison' },
    { text: 'The most certain way to succeed is always to try just one more time.', author: 'Thomas Edison' },
    { text: 'Never leave till tomorrow what you can do today.', author: 'Benjamin Franklin' },
    { text: 'Do you love life? Then do not squander time.', author: 'Benjamin Franklin' },
    { text: 'What does not kill me makes me stronger.', author: 'Friedrich Nietzsche' },
    { text: 'He who has a why can bear almost any how.', author: 'Friedrich Nietzsche' },
    { text: 'Life is like riding a bicycle. To keep your balance, keep moving.', author: 'Albert Einstein' },
    { text: 'I have no special talent. I am only passionately curious.', author: 'Albert Einstein' },
    { text: 'The unexamined life is not worth living.', author: 'Socrates' },
    { text: 'To thine own self be true.', author: 'William Shakespeare' },
    { text: 'Everyone wants to change the world. No one wants to change himself.', author: 'Leo Tolstoy' },
    { text: 'Without haste, but without rest.', author: 'Goethe' },
    { text: 'To have a fault and not correct it — that is the real fault.', author: 'Confucius' },
    { text: "Say you know what you know, and admit what you don't.", author: 'Confucius' },
    { text: 'Learning without thinking gains nothing.', author: 'Confucius' },
    { text: 'A thousand miles begins with a single step.', author: 'Lao Tzu' },
    { text: 'Knowing others is wisdom. Knowing yourself is clarity.', author: 'Lao Tzu' },
    { text: 'Optimism is the faith that leads to achievement.', author: 'Helen Keller' },
    { text: 'Alone we can do little. Together we can do much.', author: 'Helen Keller' },
    { text: 'Life is not short. We waste it.', author: 'Seneca' },
  ],
};

// 공백류(스페이스/탭/줄바꿈)와 구두점을 제거하고 소문자로 맞춘 뒤 비교한다 — 오타 판정이
// 아니라 "같은 문장을 쳤는지"만 보는 관대한 대조. \p{P}(유니코드 구두점 카테고리)로
// 한글/영문 구두점을 한 번에 처리한다(Hermes는 SDK 57 기준 유니코드 속성 이스케이프 지원).
export function normalizeMissionInput(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}]/gu, '');
}

// 정답 판정은 quote.text만 본다 — author(누가 말했는지)는 타이핑 대상이 아니다.
export function isMissionInputCorrect(input: string, quote: MissionQuote): boolean {
  return normalizeMissionInput(input) === normalizeMissionInput(quote.text);
}

// "3회 실패 시 다른(더 짧은) 명언 제시" — 실패한 문구보다 짧은 것들 중에서 무작위로
// 고른다(같은 문구가 다시 나오지 않게, 더 짧아졌다는 걸 보장). 짧은 쪽에 후보가
// 없으면(이미 가장 짧은 문구였던 경우) 전체에서 현재 문구만 제외하고 고른다.
// quotes는 호출부(app/mission.tsx)가 getMissionQuotes()로 미리 로드해 넘긴다 — 사용자가
// 설정에서 커스텀한 목록일 수도, 기본 MISSION_QUOTES일 수도 있어 이 함수는 어느 쪽인지
// 몰라도 된다(순수 함수 유지).
export function pickShorterQuote(
  quotes: MissionQuote[],
  currentQuote: MissionQuote,
  random: () => number = Math.random
): MissionQuote {
  const shorter = quotes.filter((q) => q.text.length < currentQuote.text.length);
  const pool = shorter.length > 0 ? shorter : quotes.filter((q) => q.text !== currentQuote.text);
  if (pool.length === 0) return currentQuote;
  return pool[Math.floor(random() * pool.length)];
}

export function pickRandomQuote(quotes: MissionQuote[], random: () => number = Math.random): MissionQuote {
  return quotes[Math.floor(random() * quotes.length)];
}

// 설정 화면에서 편집한 커스텀 명언 목록 — 언어별로 저장, 값이 없으면 MISSION_QUOTES
// 기본값을 쓴다.
const QUOTES_STORAGE_KEY = 'powernap:missionQuotesOverride';

type QuoteOverrides = Partial<Record<'ko' | 'en', MissionQuote[]>>;

// 이번 세션 안에서 문자열 배열(author 없음) 포맷으로 한 번 저장했을 수 있어(실기기 도그푸딩
// 중 이전 UI로 저장된 값) — 문자열이 섞여 있어도 author: ''로 정규화해 크래시 없이 읽는다.
function normalizeStoredQuote(value: unknown): MissionQuote | null {
  if (typeof value === 'string') return { text: value, author: '' };
  if (value && typeof value === 'object' && typeof (value as MissionQuote).text === 'string') {
    const q = value as MissionQuote;
    return { text: q.text, author: typeof q.author === 'string' ? q.author : '' };
  }
  return null;
}

export async function getMissionQuotes(locale: 'ko' | 'en'): Promise<MissionQuote[]> {
  const raw = await AsyncStorage.getItem(QUOTES_STORAGE_KEY);
  if (!raw) return MISSION_QUOTES[locale];
  try {
    const overrides = JSON.parse(raw) as QuoteOverrides;
    const custom = overrides[locale]?.map(normalizeStoredQuote).filter((q): q is MissionQuote => q !== null);
    return custom && custom.length > 0 ? custom : MISSION_QUOTES[locale];
  } catch {
    return MISSION_QUOTES[locale];
  }
}

export async function setMissionQuotes(locale: 'ko' | 'en', quotes: MissionQuote[]): Promise<void> {
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
