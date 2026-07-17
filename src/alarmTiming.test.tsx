// 알람 시간 조정 화면 렌더+상호작용 테스트 — mypage.test.tsx와 같은 이유로 app/ 대신
// src/에 둔다(expo-router require.context가 .test. 파일도 프로덕션 번들에 실어 expo
// export를 깨뜨린다). "+" 스테퍼를 눌러 조정한 값이 store.getSettings()에 실제로
// 반영되는지까지 확인한다 — 홈 화면(app/index.tsx)의 알람 시간 계산(fastTotal =
// TARGET_SLEEP_MIN + latency.fast)이 읽는 값과 같은 저장소라 이 화면에서 바뀐 값은
// 코드 변경 없이 그대로 다음 낮잠 알람 계산에 반영된다.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import AlarmTimingScreen from '../app/alarm-timing';
import { getSettings } from './store';

// renderRouter는 호출마다 jest.useFakeTimers()를 다시 건다 — 같은 파일에서 두 번 호출하면
// act() 경합이 난다(mypage.test.tsx/settings.test.tsx도 파일당 renderRouter 1회 관행).
// 그래서 렌더 확인과 상호작용 확인을 하나의 it으로 묶는다.
describe('AlarmTimingScreen', () => {
  it('renders the three timing rows, and adjusting the fast-mode stepper persists to the same settings the home screen alarm calculation reads', async () => {
    const before = await getSettings();
    expect(before.latency.fast).toBe(0); // 기본값

    renderRouter({ 'alarm-timing': AlarmTimingScreen }, { initialUrl: '/alarm-timing' });
    await waitFor(() => expect(screen.getByText('알람 시간 조정')).toBeTruthy());

    expect(screen.getByText('수면 대기시간 — 바로 잠들 것 같아요')).toBeTruthy();
    expect(screen.getByText('수면 대기시간 — 좀 뒤척일 것 같아요')).toBeTruthy();
    expect(screen.getByText('카페인 발현시간')).toBeTruthy();

    // 세 행(fast/slow/coffee) 모두 같은 접근성 라벨("1분 늘리기")을 쓴다(기존 stepIncreaseA11y
    // 문구가 행 이름을 포함하지 않음, mypage.tsx 시절부터 있던 동작) — ROWS 배열 순서상
    // 첫 번째(fast)가 DOM에도 첫 번째로 렌더된다.
    fireEvent.press(screen.getAllByLabelText('1분 늘리기')[0]);

    await waitFor(async () => {
      const after = await getSettings();
      expect(after.latency.fast).toBe(1);
    });
  });
});
