import { useAuthStore } from "@nimchat/sdk";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

// Mirrors apps/web's auth-gate.tsx — gates the (main) route group behind hydrate() having
// resolved to "authenticated", redirecting to /login otherwise.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status]);

  if (status === "idle" || status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (status === "anonymous") {
    return null;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
