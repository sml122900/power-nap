// app 프로젝트 전용 — jest-expo의 expo-localization 모크는 항상 'en-US'를 반환한다
// (node_modules/expo-localization/mocks/ExpoLocalization.ts), 그대로 두면 모든 테스트의
// 초기 언어가 'en'이 되어 기존 한국어 기댓값 테스트가 전부 깨진다. 각 테스트 전에 'ko'로
// 고정해 결정적으로 만든다 — 언어 전환 자체를 검증하는 테스트는 그 안에서 changeLanguage('en')을
// 직접 호출한 뒤 다음 테스트를 위해 afterEach가 다시 'ko'로 되돌린다.
const i18n = require('./src/i18n').default;

beforeEach(async () => {
  await i18n.changeLanguage('ko');
});
