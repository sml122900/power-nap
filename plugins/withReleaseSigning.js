// Expo bare 템플릿의 android/app/build.gradle은 buildTypes.release가
// signingConfigs.debug를 그대로 쓴다 — 릴리즈 빌드가 CN=Android Debug 인증서로
// 서명되어 Play 업로드가 불가능하다(2026-07-23 실기기 apksigner verify로 확인).
// android/는 prebuild --clean으로 완전히 재생성되는 gitignore 디렉터리라
// build.gradle을 직접 고쳐도 소용없다 — 매 prebuild마다 release keystore를
// 주입하는 config plugin이 필요하다.
//
// keystore 파일 자체는 리포 바깥(예: C:\Users\<user>\keys\...)에 두고, 경로/별칭/
// 비밀번호는 .env의 non-EXPO_PUBLIC_ 변수로만 관리한다 — EXPO_PUBLIC_ 접두사를
// 쓰면 babel-preset-expo가 값을 JS 번들에 리터럴로 박아 넣는다(CLAUDE.md 지뢰 목록,
// src/purchases.ts resolveApiKey 사례와 반대 방향의 같은 함정).
//
// 필수 env var 중 하나라도 없으면 조용히 debug 키로 서명되던 지금까지의 상태로
// 되돌아가지 않도록 prebuild 자체를 실패시킨다.

const { withAppBuildGradle, createRunOncePlugin } = require('@expo/config-plugins');

const ENV_VAR_NAMES = [
  'RELEASE_KEYSTORE_PATH',
  'RELEASE_KEY_ALIAS',
  'RELEASE_KEYSTORE_PASSWORD',
  'RELEASE_KEY_PASSWORD',
];

function escapeForGroovySingleQuotedString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    const missing = ENV_VAR_NAMES.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(
        `withReleaseSigning: 다음 환경변수가 없습니다 — ${missing.join(', ')}. ` +
          '이 값들이 없으면 릴리즈 빌드가 signingConfigs.debug로 조용히 서명됩니다(Play 업로드 불가). ' +
          '.env에 RELEASE_KEYSTORE_PATH / RELEASE_KEY_ALIAS / RELEASE_KEYSTORE_PASSWORD / ' +
          'RELEASE_KEY_PASSWORD를 채운 뒤 다시 prebuild하세요.'
      );
    }

    let contents = config.modResults.contents;

    if (contents.includes('signingConfigs.release')) {
      // 같은 android/ 위에서 prebuild를 다시 돌린 경우 — 이미 패치돼 있으니 스킵.
      return config;
    }

    const keystorePath = process.env.RELEASE_KEYSTORE_PATH.replace(/\\/g, '/');
    const keyAlias = escapeForGroovySingleQuotedString(process.env.RELEASE_KEY_ALIAS);
    const keystorePassword = escapeForGroovySingleQuotedString(process.env.RELEASE_KEYSTORE_PASSWORD);
    const keyPassword = escapeForGroovySingleQuotedString(process.env.RELEASE_KEY_PASSWORD);

    const releaseSigningConfigBlock = `
        release {
            storeFile file('${keystorePath}')
            storePassword '${keystorePassword}'
            keyAlias '${keyAlias}'
            keyPassword '${keyPassword}'
        }`;

    if (!/signingConfigs\s*\{/.test(contents)) {
      throw new Error(
        'withReleaseSigning: android/app/build.gradle에서 signingConfigs { 블록을 찾지 못했습니다 — ' +
          'Expo/React Native 템플릿이 바뀌었을 수 있으니 plugins/withReleaseSigning.js를 다시 확인하세요.'
      );
    }
    contents = contents.replace(/signingConfigs\s*\{/, (match) => `${match}${releaseSigningConfigBlock}`);

    const releaseBuildTypePattern = /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!releaseBuildTypePattern.test(contents)) {
      throw new Error(
        'withReleaseSigning: buildTypes.release의 signingConfig signingConfigs.debug 를 찾지 못했습니다 — ' +
          'Expo/React Native 템플릿이 바뀌었을 수 있으니 plugins/withReleaseSigning.js를 다시 확인하세요.'
      );
    }
    contents = contents.replace(releaseBuildTypePattern, '$1signingConfig signingConfigs.release');

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withReleaseSigning, 'powernap-release-signing', '1.0.0');
