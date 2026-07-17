// 화면 테마 — 설정의 언어 선택과 동일한 구조(AsyncStorage 수동 선택 > 기기 설정 > 기본값)를
// 재사용한다. 언어(i18n.ts)와 다른 점: 언어는 i18next 싱글턴이 React 트리 밖에서도 전역
// 상태를 갖지만, useColorScheme()은 React 훅이라 Provider 없이는 "현재 테마"를 앱 전역에서
// 읽을 방법이 없다 — 그래서 여기는 Context가 필요하다.
//
// 수면/알람/미션/기상루틴 화면은 이 Context를 쓰지 않는다 — 테마와 무관하게 항상
// src/theme.ts의 `colors`(라이트 값 고정)를 직접 import한다(DESIGN_HANDOFF 참고).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import { colors as lightColors, darkColors, type ThemeColors } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'powernap:themePreference';

export async function getThemePreference(): Promise<ThemePreference> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  if (pref === 'system') {
    await AsyncStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, pref);
  }
}

// 테마 판정만 떼어낸 순수 함수 — useNapWatchdog.ts의 resolveNapRoute와 같은 패턴
// (React/네이티브 Appearance 모듈 없이 jest로 직접 검증한다).
export function resolveColorScheme(preference: ThemePreference, systemScheme: ColorSchemeName | null | undefined): ColorScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

interface ThemeContextValue {
  colors: ThemeColors;
  scheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// app/_layout.tsx가 부팅 시 저장된 선택을 미리 읽어 initialPreference로 넘긴다(언어 로딩과
// 같은 스플래시 게이트 패턴) — Provider 안에서 또 한 번 비동기로 읽으면 첫 프레임에 잘못된
// 테마가 잠깐 보이는 FOUC가 생긴다.
export function ThemeProvider({
  children,
  initialPreference,
}: {
  children: ReactNode;
  initialPreference: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  useEffect(() => {
    setPreferenceState(initialPreference);
  }, [initialPreference]);

  const scheme = resolveColorScheme(preference, systemScheme);
  const resolvedColors = scheme === 'dark' ? darkColors : lightColors;

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    void setThemePreference(pref);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ colors: resolvedColors, scheme, preference, setPreference }),
    [resolvedColors, scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('ThemeProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}

export function useThemeColors(): ThemeColors {
  return useThemeContext().colors;
}

// 설정 화면(테마 선택 UI)과 상태바 색 전환(app/_layout.tsx)에서 쓴다.
export function useThemeScheme(): { scheme: ColorScheme; preference: ThemePreference; setPreference: (pref: ThemePreference) => void } {
  const { scheme, preference, setPreference } = useThemeContext();
  return { scheme, preference, setPreference };
}
