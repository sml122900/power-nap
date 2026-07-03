// 시각 포맷 유틸 — powernap-prototype.html의 fmtKorean() 이식.
// 홈(§6.1)뿐 아니라 Phase 2 수면 화면의 "오후 h:mm에 깨워드릴게요" 표시에도 재사용한다.

export function formatKoreanTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const mm = String(minutes).padStart(2, '0');
  return `${ampm} ${hour12}:${mm}`;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
