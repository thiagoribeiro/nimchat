import * as SecureStore from "expo-secure-store";
import type { TokenStorage } from "@nimchat/sdk";

const KEY = "nimchat_access_token";

// SecureStore backs this with EncryptedSharedPreferences (Android) / Keychain (iOS) —
// encrypted at rest, unlike AsyncStorage's plaintext files. This is the one place the app
// holds a real credential, so it gets the stronger option even though it's a bit slower.
export class SecureStoreTokenStorage implements TokenStorage {
  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY);
  }

  async setToken(token: string | null): Promise<void> {
    if (token) {
      await SecureStore.setItemAsync(KEY, token);
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  }
}
