// 디자인 토큰 — PROJECT.md 섹션 2 (디자인 헌법) 기준. powernap-prototype.html의 CSS 변수와 1:1 대응.

export const colors = {
  brand: '#4353E0',
  brandPress: '#3542C4',
  brandTint: '#EEF0FD',
  night: '#12172A',
  nightSoft: '#8B93B0',
  amber: '#E8981F',
  amberTint: '#FDF3E2',
  ink: '#161D2E',
  inkSoft: '#5A6478',
  inkFaint: '#98A0B3',
  line: '#DFE4EE',
  surface: '#FFFFFF',
  bg: '#ECEFF5',
} as const;

export const radius = {
  lg: 24,
  md: 16,
} as const;

// 위계는 폰트 굵기와 크기로만 표현한다 (아이콘/그라데이션 금지).
export const fontWeight = {
  heavy: '800',
  bold: '700',
  semibold: '600',
} as const;

// 숫자(카운트다운, 시각)는 전부 tabular-nums로 렌더링한다.
export const tabularNums = {
  fontVariant: ['tabular-nums'] as const,
};

export const touchTarget = {
  min: 44,
  primary: 120,
} as const;

export const theme = {
  colors,
  radius,
  fontWeight,
  tabularNums,
  touchTarget,
} as const;

export type Theme = typeof theme;
