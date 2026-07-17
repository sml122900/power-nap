// 다크 모드 팔레트(darkColors)가 라이트(colors)와 같은 키 집합을 갖는지, 그리고
// DESIGN_HANDOFF.md에 적어둔 대비 근거(브랜드 블루는 텍스트 전용 변형 필요, 앰버는
// 불필요, danger는 다크 변형 필요)가 실제 값에 반영됐는지 확인한다.
import { colors, darkColors } from './theme';

describe('darkColors', () => {
  it('has exactly the same keys as colors', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
  });

  it('keeps solid fill colors (brand/amber) identical across themes — buttons should not change', () => {
    expect(darkColors.brand).toBe(colors.brand);
    expect(darkColors.brandPress).toBe(colors.brandPress);
    expect(darkColors.amber).toBe(colors.amber);
  });

  it('lightens brand for text-on-surface use (brand blue fails AA contrast on dark surfaces as-is)', () => {
    // 라이트에선 brandOnSurface가 brand와 동일 — 기존 화면 겉모습이 안 바뀐다.
    expect(colors.brandOnSurface).toBe(colors.brand);
    // 다크에선 더 밝은 변형이어야 한다(텍스트 대비 확보) — 채움색 brand와는 달라야 함.
    expect(darkColors.brandOnSurface).not.toBe(colors.brand);
  });

  it('lightens danger for legibility on dark surfaces', () => {
    expect(darkColors.danger).not.toBe(colors.danger);
  });

  it('flips the neutral scale (ink/surface/bg) between light and dark', () => {
    expect(darkColors.ink).not.toBe(colors.ink);
    expect(darkColors.surface).not.toBe(colors.surface);
    expect(darkColors.bg).not.toBe(colors.bg);
    // 다크 bg는 새 색을 만들지 않고 기존 night 토큰을 재사용한다.
    expect(darkColors.bg).toBe(colors.night);
  });

  it('keeps the always-on-dark overlay tokens unchanged (only used by theme-invariant screens)', () => {
    expect(darkColors.onDarkMuted).toBe(colors.onDarkMuted);
    expect(darkColors.onDarkFaint).toBe(colors.onDarkFaint);
    expect(darkColors.onDarkBorder).toBe(colors.onDarkBorder);
    expect(darkColors.onDarkBorderPress).toBe(colors.onDarkBorderPress);
    expect(darkColors.onDarkOverlaySubtle).toBe(colors.onDarkOverlaySubtle);
    expect(darkColors.onDarkHint).toBe(colors.onDarkHint);
    expect(darkColors.night).toBe(colors.night);
    expect(darkColors.nightSoft).toBe(colors.nightSoft);
  });
});
