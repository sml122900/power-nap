import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// 알림 표시 정책(setNotificationHandler, iOS 백업 레이어용)을 앱 부팅 시 항상 등록한다 —
// 재시작 후 ActiveNap이 복원돼 /sleep이나 /alarm으로 바로 이동하는 경우에도 루트 레이아웃은
// 항상 먼저 마운트되므로 여기서 import하는 것이 가장 안전하다. Android 알림 채널은 이제
// expo-alarm-module이 네이티브 모듈 초기화 시점에 자체 생성하므로 여기서 따로 챙길 게 없다.
import '@/notifications';
import { loadPersistedLanguagePreference } from '@/i18n';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
  });
  // i18n.ts의 동기 init()이 이미 기기 언어로 초기화해두지만, 저장된 수동 선택이 있으면
  // 그걸로 바꿔야 한다 — 이 비동기 조회가 끝날 때까지 스플래시를 유지해 언어가 바뀌는
  // 화면 깜빡임(FOUC)을 막는다(fontsLoaded와 같은 패턴).
  const [langLoaded, setLangLoaded] = useState(false);

  useEffect(() => {
    loadPersistedLanguagePreference().finally(() => setLangLoaded(true));
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && langLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, langLoaded]);

  if ((!fontsLoaded && !fontError) || !langLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
