// Pluggable so apps/web can back it with localStorage and apps/mobile can back it with
// AsyncStorage/SecureStore without the SDK knowing about either.
export interface TokenStorage {
  getToken(): string | null | Promise<string | null>;
  setToken(token: string | null): void | Promise<void>;
}

export class InMemoryTokenStorage implements TokenStorage {
  private token: string | null = null;

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string | null): void {
    this.token = token;
  }
}

export class LocalStorageTokenStorage implements TokenStorage {
  private readonly key: string;
  constructor(key = "nimchat_access_token") {
    this.key = key;
  }

  getToken(): string | null {
    return window.localStorage.getItem(this.key);
  }

  setToken(token: string | null): void {
    if (token) {
      window.localStorage.setItem(this.key, token);
    } else {
      window.localStorage.removeItem(this.key);
    }
  }
}
