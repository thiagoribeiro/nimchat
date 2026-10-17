import "react-native-get-random-values"; // must be first — see uuid/Hermes note in the plan

import { useFonts } from "expo-font";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { AuthProvider } from "@/components/providers/auth-provider";
import { SyncProvider } from "@/components/providers/sync-provider";
import { setupForegroundDigestListener, setupNotificationTapListener } from "@/lib/push-notifications";
import { routes } from "@/lib/routes";
import { colors } from "@/theme/tokens";
import { fontAssets } from "@/theme/typography";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Inter is bundled with the app; a load failure falls back to the system font.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Foreground: a data-only push arriving while the JS app is alive doesn't show
  // anything on its own — we build the notification(s) ourselves. Tap: deep-links to
  // the room (single-room digest) or the room list (multi-room summary); AuthGate
  // handles redirecting to /login first if the session isn't live.
  useEffect(() => {
    const foregroundSub = setupForegroundDigestListener();
    const tapSub = setupNotificationTapListener(
      (roomId) => router.push(routes.room(roomId)),
      () => router.push(routes.rooms),
    );
    return () => {
      foregroundSub.remove();
      tapSub.remove();
    };
  }, []);

  if (!ready) return null;

  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(main)" />
        </Stack>
      </SyncProvider>
    </AuthProvider>
  );
}
