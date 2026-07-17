// 수면/알람/미션/기상루틴 화면은 화면 테마와 무관하게 항상 같은 색을 써야 한다
// (DESIGN_HANDOFF.md "화면 테마" 참고 — 수면 화면은 빛 차단이라는 기능적 이유, 알람/미션/
// 기상루틴은 해제 인터랙션 가시성 + 연속된 흐름이라는 이유). 이 화면들을 실제로 마운트해
// 배경색을 확인하는 렌더 테스트는 sleep.tsx가 쓰는 reanimated useSharedValue가 이 프로젝트
// jest 환경에 목이 없어 렌더 자체가 실패한다(별도 인프라 정비가 필요해 이번 범위 밖) —
// 대신 소스가 정적 `colors`만 참조하고 테마 반응형 훅(useThemeColors)을 쓰지 않는지
// 소스 텍스트로 직접 확인한다. 실수로 훅을 쓰게 바뀌면 이 테스트가 잡는다.
import { readFileSync } from 'fs';
import { join } from 'path';

const INVARIANT_FILES = [
  'app/sleep.tsx',
  'app/alarm.tsx',
  'app/mission.tsx',
  'src/WakeRoutineScreen.tsx',
  'src/SlideToConfirm.tsx',
];

describe('theme-invariant screens stay wired to the static light palette', () => {
  it.each(INVARIANT_FILES)('%s imports colors directly and never useThemeColors', (relativePath) => {
    const source = readFileSync(join(__dirname, '..', relativePath), 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*\bcolors\b[^}]*\}\s*from\s*['"].*theme['"]/);
    expect(source).not.toMatch(/useThemeColors/);
    expect(source).not.toMatch(/@\/ThemeContext|['"]\.\/ThemeContext['"]/);
  });
});
