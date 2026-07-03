// 디자인 토큰 — PROJECT.md 섹션 2 (디자인 헌법) 기준. powernap-prototype.html의 CSS 변수와 1:1 대응.

import type { FontVariant } from 'react-native';

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

// 커스텀 폰트(OTF)는 RN에서 fontWeight 스타일 prop을 무시하므로(OS 기본 폰트만 굵기
// 변형을 인식) 굵기마다 별도 fontFamily를 등록해 사용한다. app/_layout.tsx의
// useFonts 키와 이름이 일치해야 한다.
export const fontFamily = {
  heavy: 'Pretendard-ExtraBold', // 800
  bold: 'Pretendard-Bold', // 700
  semibold: 'Pretendard-SemiBold', // 600
  regular: 'Pretendard-Regular', // 400 — 본문/캡션
} as const;

// 숫자(카운트다운, 시각)는 전부 tabular-nums로 렌더링한다.
// 폴백 방침: fontVariant: 'tabular-nums'는 폰트가 OpenType 'tnum' 피처를 노출하고
// OS가 이를 렌더러에 전달할 때만 적용된다. Pretendard 정적 OTF는 이 피처를 지원하지만,
// 구형 Android(9 이하) 등 플랫폼이 무시하면 숫자 폭이 흔들려 자릿수가 바뀔 때 좌우로
// 밀리는 것처럼 보일 수 있다. 실기기 확인 결과 시각적으로 어긋나면, 숫자를 감싸는
// Text/View에 고정 minWidth를 주고 textAlign을 'right' 또는 'center'로 고정해
// 자릿수 변화가 레이아웃을 흔들지 않도록 한다 (폰트 교체는 하지 않는다).
export const tabularNums: { fontVariant: FontVariant[] } = {
  fontVariant: ['tabular-nums'],
};

export const touchTarget = {
  min: 44,
  primary: 120,
} as const;

export const theme = {
  colors,
  radius,
  fontWeight,
  fontFamily,
  tabularNums,
  touchTarget,
} as const;

export type Theme = typeof theme;
