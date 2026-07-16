// resolveColorScheme(preference, systemScheme) — 라우팅 판정을 순수 함수로 뗀
// useNapWatchdog.ts의 resolveNapRoute와 같은 패턴. react-native의 useColorScheme()은
// 내부적으로 네이티브 Appearance 모듈을 useSyncExternalStore로 구독해서, jest 환경에서
// 반환값을 안정적으로 바꿔치기할 방법이 없다(Appearance.getColorScheme을 스파이해도
// useColorScheme.js가 별도로 바인딩해간 참조라 반영되지 않음, 실제로 확인함) — 그래서
// 판정 로직 자체를 순수 함수로 분리해 훅/렌더 없이 직접 검증한다.
import { resolveColorScheme } from './ThemeContext';

describe('resolveColorScheme', () => {
  it('follows the system scheme when preference is system', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('treats a missing/unknown system report as light', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
  });

  it('manual light overrides a dark system setting', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
  });

  it('manual dark overrides a light system setting', () => {
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });
});
