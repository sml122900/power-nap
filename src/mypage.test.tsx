// 마이페이지 렌더 테스트 — settings.test.tsx와 동일한 이유로 app/ 대신 src/에 둔다
// (expo-router require.context가 .test. 파일도 프로덕션 번들에 실어 expo export를
// 깨뜨린다). 기본 상태(aiConsent 미조회=null)에서는 getCreditBalance()를 호출하지
// 않으므로("동의 전엔 서버로 아무것도 안 보낸다" 원칙) supabase/aiAnalysis를 목킹할
// 필요가 없다 — 미동의 안내 문구만 확인한다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import MyPageScreen from '../app/mypage';
import { ThemeProvider } from './ThemeContext';

// MyPageScreen이 useThemeColors()를 쓰므로 ThemeProvider 밖에서는 렌더 자체가 던진다 —
// settings.test.tsx와 동일한 이유로 여기서 직접 감싼다.
function ThemedMyPageScreen() {
  return (
    <ThemeProvider initialPreference="system">
      <MyPageScreen />
    </ThemeProvider>
  );
}

describe('MyPageScreen', () => {
  it('renders the credit notice, sleep-timing section, and all four nav links', async () => {
    renderRouter({ mypage: ThemedMyPageScreen }, { initialUrl: '/mypage' });

    await waitFor(() => expect(screen.getByText('낮잠 타이밍 조정')).toBeTruthy());

    expect(screen.getByText('AI 분석에 동의하면 남은 이용권을 확인할 수 있어요')).toBeTruthy();
    expect(screen.getByText('낮잠 기록')).toBeTruthy();
    expect(screen.getByText('AI 분석 기록')).toBeTruthy();
    expect(screen.getByText('결제 내역')).toBeTruthy();
    expect(screen.getByText('명언 수정')).toBeTruthy();
  });
});
