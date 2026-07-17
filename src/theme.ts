// 디자인 토큰 — PROJECT.md 섹션 2 (디자인 헌법) 기준. powernap-prototype.html의 CSS 변수와 1:1 대응.

import type { FontVariant } from 'react-native';

export const colors = {
  brand: '#4353E0',
  brandPress: '#3542C4',
  brandTint: '#EEF0FD',
  // brand를 텍스트/아이콘 색으로 중립 surface 위에 얹을 때 전용(버튼 채움색인 brand와는
  // 별도 토큰) — 라이트에선 brand와 동일하지만, 다크에선 채움색 그대로 쓰면 텍스트 대비가
  // 무너져(§ 다크 모드 명도 변형 근거 참고) 더 밝은 변형이 필요하다.
  brandOnSurface: '#4353E0',
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

  // night/brand 배경 위 반투명 흰색 오버레이 — powernap-prototype.html의 인라인 rgba 값 이식.
  // §2 핵심 팔레트에는 없지만 동일한 단일 소스 원칙(theme.ts)을 지키기 위해 여기 모은다.
  // 항상 다크/브랜드 배경 위에서만 쓰이는 토큰이라 다크 모드 전환과 무관 — darkColors에서도
  // 값을 그대로 유지한다.
  onDarkMuted: 'rgba(255,255,255,0.75)', // 수면/알람 화면의 보조 텍스트
  onDarkFaint: 'rgba(255,255,255,0.72)', // 알람 시각(primary 버튼) 보조 텍스트
  onDarkBorder: 'rgba(255,255,255,0.18)', // 고스트 버튼/토글 행 테두리
  onDarkBorderPress: 'rgba(255,255,255,0.08)', // 고스트 버튼 프레스 배경
  onDarkOverlaySubtle: 'rgba(255,255,255,0.14)', // 알람 화면 커피 배지 배경
  onDarkHint: 'rgba(255,255,255,0.35)', // 대체 해제 수단 같은 최소 강조 안내 텍스트

  // 커피냅 버튼/칩 전용 보조 색
  amberBorder: '#F0D3A4',
  amberPress: '#F5E4C3', // amberTint보다 한 단계 진한 프레스 상태 — brandPress/secondaryPressed와 같은 역할

  // 파괴적 동작(낮잠 기록 삭제 등) 전용 — brand/amber와 같은 패턴(기본색 + 프레스 시 한 단계 진하게).
  danger: '#E14B4B',
  dangerPress: '#C93E3E',
} as const;

// 다크 모드 팔레트 — DESIGN_HANDOFF 색 제한(브랜드 1개 + 무채색 + 포인트 1개) 유지, 새 색상
// 추가 없이 기존 팔레트의 명도 변형만. `colors`와 완전히 같은 키 집합(Record 타입으로 강제) —
// 화면은 이 파일이 아니라 useThemeColors() 훅을 통해 라이트/다크 중 하나를 받는다
// (src/ThemeContext.tsx 참고). 수면/알람/미션/기상루틴 화면은 테마와 무관하게 항상
// `colors`(라이트 값 고정)를 직접 쓴다 — DESIGN_HANDOFF "수면 화면은 다크 고정" 참고.
export const darkColors: Record<keyof typeof colors, string> = {
  brand: colors.brand, // 채움색(버튼 배경)은 테마 무관 고정 — 흰 텍스트와의 대비가 이미 충분(§ 근거)
  brandPress: colors.brandPress,
  brandTint: '#232A4A', // 라이트의 파스텔 톤(#EEF0FD)을 다크 표면 위에서 보이는 짙은 톤으로
  // 채움색(brand)과 달리 흰 텍스트가 아니라 자기 자신이 텍스트 색으로 쓰일 때만 밝게 —
  // #4353E0는 다크 배경에서 최대 대비가 약 3.55:1(순검정 대비)로 AA 본문 기준(4.5:1)에
  // 못 미쳐 약 35% 흰색 블렌드(#8590EA, night 대비 약 6:1)로 대체.
  brandOnSurface: '#8590EA',
  night: colors.night,
  nightSoft: colors.nightSoft,
  amber: colors.amber, // #E8981F는 순검정 대비 약 8.9:1로 여유가 커 다크에서도 변경 불필요(§ 근거)
  amberTint: '#332912',
  ink: '#F1F3FA',
  inkSoft: '#AEB4CC',
  inkFaint: '#7E87A6',
  line: '#2E3350',
  surface: '#1C2136',
  bg: colors.night, // 기존 night 토큰을 그대로 재사용 — 새 색 추가 없음

  onDarkMuted: colors.onDarkMuted,
  onDarkFaint: colors.onDarkFaint,
  onDarkBorder: colors.onDarkBorder,
  onDarkBorderPress: colors.onDarkBorderPress,
  onDarkOverlaySubtle: colors.onDarkOverlaySubtle,
  onDarkHint: colors.onDarkHint,

  amberBorder: '#5C4720',
  amberPress: '#402F14',

  // #E14B4B는 다크 표면(#1C2136) 대비 약 3.2:1로 AA 본문 기준에 못 미쳐 20% 흰색 블렌드로 보정
  // (night 대비 약 5.8:1). fill(배경 채움)로 쓰인 곳이 없어 채움/텍스트 분리 없이 통째로 교체.
  danger: '#E76F6F',
  dangerPress: '#D65858',
} as const;

// 훅이 라이트/다크 중 하나를 돌려줄 때 쓰는 구조적 타입 — `colors`(as const, 리터럴 타입)와
// `darkColors`(일반 string) 양쪽 다 이 타입을 만족해야 화면에서 교체 가능하다.
export type ThemeColors = Record<keyof typeof colors, string>;

export const radius = {
  lg: 24,
  md: 16,
  sm: 6,
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
