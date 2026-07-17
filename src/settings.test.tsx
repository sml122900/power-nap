// 설정 화면 스크롤 회귀 방지용 렌더 테스트 — 6개 섹션(언어/미션/기상 루틴/데이터 및 분석/
// 데이터 삭제/약관 및 정책)이 전부 트리에 존재하는지만 확인한다(스냅샷 수준). 낮잠 타이밍
// 조정/명언 수정/구매 복원은 마이페이지(mypage.test.tsx)로 이동했다. ScrollView 없이
// plain View로 되돌아가면 화면 자체는 여전히 렌더되므로, 이 테스트는 "스크롤 가능 여부"가
// 아니라 "섹션이 전부 마운트되는지"를 지킨다 — 실제 스크롤 동작은 실기기 확인 몫.
//
// app/ 대신 src/에 둔 이유: expo-router의 require.context가 app/ 아래 모든 파일을
// 프로덕션 번들에도 포함시킨다(파일명에 .test.가 있어도 필터링 안 됨, 실제 라우트가
// 아닌 것과 무관 — `expo export` 시도로 확인됨). 이 테스트가 쓰는
// expo-router/testing-library는 Node 전용 `path` 모듈을 끌어와 Metro가 iOS 번들에
// 넣을 수 없어 export가 깨진다. src/는 require.context 스캔 대상이 아니라 안전하다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);
// getLanguagePreference/setLanguagePreference lazy-import AsyncStorage via `await import(...)`
// (src/i18n.ts, 순수 함수 테스트 보호 목적) — 이 dynamic import는 jest-expo의 metro caller
// 설정상 실제 커밋되지 않고 네이티브 import()로 남아 "--experimental-vm-modules 없이 호출됨"
// 에러가 난다(이 화면 렌더 테스트가 처음으로 이 경로를 태워서 드러난 기존 인프라 갭 —
// 이 테스트 범위 밖이라 언어 선택 함수만 목).
jest.mock('@/i18n', () => ({
  ...jest.requireActual('@/i18n'),
  getLanguagePreference: jest.fn().mockResolvedValue('system'),
  setLanguagePreference: jest.fn().mockResolvedValue(undefined),
}));

import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import SettingsScreen from '../app/settings';
import { ThemeProvider } from './ThemeContext';

// SettingsScreen이 useThemeColors()를 쓰므로 ThemeProvider 밖에서는 렌더 자체가 던진다 —
// 실제 앱은 app/_layout.tsx가 항상 감싸주지만, 이 테스트는 화면만 단독 렌더하는
// renderRouter 패턴이라 여기서 직접 감싼다.
function ThemedSettingsScreen() {
  return (
    <ThemeProvider initialPreference="system">
      <SettingsScreen />
    </ThemeProvider>
  );
}

describe('SettingsScreen', () => {
  it('renders all six sections, and no longer the items moved to mypage', async () => {
    renderRouter({ settings: ThemedSettingsScreen }, { initialUrl: '/settings' });

    // 초기 렌더는 getSettings() 비동기 로드 전이라 빈 View — 로드 완료를 기다린다.
    await waitFor(() => expect(screen.getByText('언어')).toBeTruthy());

    expect(screen.getByText('알람 해제 미션')).toBeTruthy();
    expect(screen.getByText('기상 루틴')).toBeTruthy();
    expect(screen.getByText('데이터 및 분석')).toBeTruthy();
    expect(screen.getByText('데이터 삭제')).toBeTruthy();
    expect(screen.getByText('약관 및 정책')).toBeTruthy();

    // 낮잠 타이밍 조정/명언 수정/구매 복원은 마이페이지로 이동했다 — 여기 없어야 한다.
    expect(screen.queryByText('낮잠 타이밍 조정')).toBeNull();
    expect(screen.queryByText('명언 수정')).toBeNull();
    expect(screen.queryByText('구매 복원')).toBeNull();
  });
});
