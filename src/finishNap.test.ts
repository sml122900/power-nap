jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { resolveFinishNapDestination } from './finishNap';

describe('resolveFinishNapDestination', () => {
  it('goes to the wake routine first when it is enabled', () => {
    expect(resolveFinishNapDestination(true)).toBe('/wake-stretch');
  });

  it('skips straight to feedback when the wake routine is off', () => {
    expect(resolveFinishNapDestination(false)).toBe('/feedback');
  });
});
