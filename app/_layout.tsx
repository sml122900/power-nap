import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// 알림 표시 정책(setNotificationHandler, iOS 백업 레이어용)을 앱 부팅 시 항상 등록한다 —
// 재시작 후 ActiveNap이 복원돼 /sleep이나 /alarm으로 바로 이동하는 경우에도 루트 레이아웃은
// 항상 먼저 마운트되므로 여기서 import하는 것이 가장 안전하다. Android 알림 채널은 이제
// expo-alarm-module이 네이티브 모듈 초기화 시점에 자체 생성하므로 여기서 따로 챙길 게 없다.
import '@/notifications';
import { loadPersistedLanguagePreference } from '@/i18n';
import { getThemePreference, ThemeProvider, useThemeScheme, type ThemePreference } from '@/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

// ThemeProvider 안에서만 현재 테마를 알 수 있어 별도 컴포넌트로 분리 — 상태바 아이콘 색을
// 해석된 테마에 맞춘다. 수면/알람/미션/기상루틴 화면은 이 전역 설정과 무관하게 각자
// <StatusBar style="light" />를 자체적으로 덮어써 항상 밝은 아이콘을 유지한다(그 화면들은
// 테마와 무관하게 항상 어두운/브랜드 배경이라 — DESIGN_HANDOFF 참고).
function ThemedStatusBar() {
  const { scheme } = useThemeScheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
  });
  // i18n.ts의 동기 init()이 이미 기기 언어로 초기화해두지만, 저장된 수동 선택이 있으면
  // 그걸로 바꿔야 한다 — 이 비동기 조회가 끝날 때까지 스플래시를 유지해 언어가 바뀌는
  // 화면 깜빡임(FOUC)을 막는다(fontsLoaded와 같은 패턴). 테마 선택도 같은 이유로 여기서
  // 미리 읽어 ThemeProvider에 초기값으로 넘긴다(Provider 안에서 또 비동기로 읽으면 첫
  // 프레임에 라이트 테마가 잠깐 보이는 FOUC가 생긴다).
  const [langLoaded, setLangLoaded] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    Promise.all([loadPersistedLanguagePreference(), getThemePreference().then(setThemePref)]).finally(() =>
      setLangLoaded(true)
    );
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && langLoaded && themePref !== null) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, langLoaded, themePref]);

  if ((!fontsLoaded && !fontError) || !langLoaded || themePref === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider initialPreference={themePref}>
        <SafeAreaProvider>
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
