import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api } from "./api";
import type { SessionMarker } from "./types";

const SESSION_KEY = "clockwise.session";

type AuthValue = {
  ready: boolean;
  tokens: SessionMarker | null;
  signIn(identity: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<SessionMarker | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_KEY)
      .then((value) => value && setTokens(JSON.parse(value)))
      .catch(() => SecureStore.deleteItemAsync(SESSION_KEY))
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    ready,
    tokens,
    async signIn(identity, password) {
      const next: SessionMarker = await api.login(identity, password);
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      setTokens(next);
    },
    async signOut() {
      if (tokens) await api.logout().catch(() => undefined);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setTokens(null);
    },
  }), [ready, tokens]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
