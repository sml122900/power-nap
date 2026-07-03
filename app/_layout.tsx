import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// 알림 표시 정책(setNotificationHandler)을 앱 부팅 시 항상 등록한다 — 재시작 후
// ActiveNap이 복원돼 /sleep이나 /alarm으로 바로 이동하는 경우에도 루트 레이아웃은
// 항상 먼저 마운트되므로 여기서 import하는 것이 가장 안전하다.
import { ensureAndroidChannelAsync } from '@/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // 낮잠을 시작하기 전에도 Android 알림 채널이 존재하도록 부팅 시 1회 생성한다.
  useEffect(() => {
    ensureAndroidChannelAsync();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
