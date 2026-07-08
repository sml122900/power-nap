// 시각 포맷 유틸 — powernap-prototype.html의 fmtKorean() 이식, 이후 다국어 대응으로 언어별
// 포맷터 레지스트리로 확장. 언어 인자를 생략하면 i18n.language(현재 앱 언어)를 따른다 —
// 화면 컴포넌트가 useTranslation()으로 언어 변경 시 리렌더되면 여기 인라인 호출도 그 렌더에서
// 최신 언어로 재계산된다(별도 구독 불필요). 새 언어 추가 시 이 레지스트리에 포맷터만 더하면 된다.
import i18n from './i18n';

const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatTimeKo(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, '0');
  return `${ampm} ${hour12}:${mm}`;
}

function formatTimeEn(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, '0');
  return `${hour12}:${mm} ${ampm}`;
}

const TIME_FORMATTERS: Record<string, (date: Date) => string> = {
  ko: formatTimeKo,
  en: formatTimeEn,
};

export function formatTime(date: Date, language: string = i18n.language): string {
  return (TIME_FORMATTERS[language] ?? formatTimeEn)(date);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatDateTimeKo(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${formatTimeKo(date)}`;
}

function formatDateTimeEn(date: Date): string {
  return `${MONTH_NAMES_EN[date.getMonth()]} ${date.getDate()}, ${formatTimeEn(date)}`;
}

const DATE_TIME_FORMATTERS: Record<string, (date: Date) => string> = {
  ko: formatDateTimeKo,
  en: formatDateTimeEn,
};

export function formatDateTime(date: Date, language: string = i18n.language): string {
  return (DATE_TIME_FORMATTERS[language] ?? formatDateTimeEn)(date);
}
