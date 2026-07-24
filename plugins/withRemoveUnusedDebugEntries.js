// 릴리즈 APK 무결성 점검(§1 P0)에서 발견 — 앱이 전혀 쓰지 않는 두 항목이 release APK에
// 섞여 들어온다. "release에 debug AAR이 섞였다"가 아니라 서로 다른 두 원인이 각각
// 매니페스트에 항목을 하나씩 얹은 것으로 확인됨(둘 다 aapt2 dump + manifest-merger-blame
// 리포트로 실증):
//
// 1. SYSTEM_ALERT_WINDOW — 우리 코드/플러그인 어디에도 이 권한을 추가하는 곳이 없다.
//    `@expo/config-plugins`의 기본 AndroidManifest 템플릿(withAndroidBaseMods.js)이
//    "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED" 주석과 함께 새 프로젝트
//    기본값으로 항상 넣어주는 것 — `expo prebuild --clean`으로 매니페스트를 새로
//    생성할 때마다 다시 나타난다. app/sleep.tsx에 이미 "오버레이 권한 의도적으로 안 씀"
//    주석이 있을 만큼 실제로 쓰지 않는 권한이라 명시적으로 제거한다.
//
// 2. DevSettingsActivity — expo-alarm-module@1.2.0 자신의
//    android/src/main/AndroidManifest.xml에 build-type 구분 없이 하드코딩돼 있다
//    (React Native 디버그 전용 컴포넌트를 그 라이브러리가 자기 메인 매니페스트에 잘못
//    박아넣은 것 — 라이브러리 쪽 버그, 우리 코드 문제 아님). react-native 자체의
//    src/debug/AndroidManifest.xml에도 같은 컴포넌트가 있어 처음엔 "debug AAR 오염"으로
//    오인했지만, manifest-merger-blame 리포트로 실제 출처가 expo-alarm-module의 release
//    매니페스트임을 확인했다. Gradle 매니페스트 병합은 라이브러리가 선언한 노드라도
//    앱 매니페스트에 같은 노드를 tools:node="remove"로 선언하면 최종 결과에서 뺄 수 있다
//    (표준 매니페스트 병합 규칙).
//
// 라이브러리를 업그레이드해 이 문제가 자체적으로 고쳐지면 이 플러그인은 그냥 아무 일도
// 안 하는 채로 남는다(제거 대상이 애초에 없으면 무해) — 버전 결합 걱정 없음.
const { AndroidConfig, withAndroidManifest, createRunOncePlugin } = require('@expo/config-plugins');

function withRemoveUnusedDebugEntries(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Permissions.removePermissions(config.modResults, ['android.permission.SYSTEM_ALERT_WINDOW']);

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    if (!Array.isArray(app.activity)) app.activity = [];
    app.activity = app.activity.filter(
      (a) => a.$?.['android:name'] !== 'com.facebook.react.devsupport.DevSettingsActivity'
    );
    app.activity.push({
      $: {
        'android:name': 'com.facebook.react.devsupport.DevSettingsActivity',
        'tools:node': 'remove',
      },
    });

    return config;
  });
}

module.exports = createRunOncePlugin(withRemoveUnusedDebugEntries, 'powernap-remove-unused-debug-entries', '1.0.0');
