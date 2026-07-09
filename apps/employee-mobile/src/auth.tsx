import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, configureServerUrl, getServerUrl } from "./api";
import type { SessionMarker } from "./types";

const SESSION_KEY = "clockwise.session";
const SERVER_URL_KEY = "clockwise.serverUrl";

type AuthValue = {
  ready: boolean;
  tokens: SessionMarker | null;
  serverUrl: string;
  signIn(identity: string, password: string, serverUrl: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [tokens, setTokens] = useState<SessionMarker | null>(null);
  const [serverUrl, setServerUrl] = useState(getServerUrl());

  useEffect(() => {
    Promise.all([SecureStore.getItemAsync(SESSION_KEY), SecureStore.getItemAsync(SERVER_URL_KEY)])
      .then(([sessionValue, savedServerUrl]) => {
        if (savedServerUrl) {
          configureServerUrl(savedServerUrl);
          setServerUrl(getServerUrl());
        }
        if (sessionValue) setTokens(JSON.parse(sessionValue));
      })
      .catch(() => {
        void SecureStore.deleteItemAsync(SESSION_KEY);
        void SecureStore.deleteItemAsync(SERVER_URL_KEY);
      })
      .finally(() => setReady(true));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    ready,
    tokens,
    serverUrl,
    async signIn(identity, password, nextServerUrl) {
      configureServerUrl(nextServerUrl);
      setServerUrl(getServerUrl());
      const next: SessionMarker = await api.login(identity, password);
      await SecureStore.setItemAsync(SERVER_URL_KEY, getServerUrl(), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      setTokens(next);
    },
    async signOut() {
      if (tokens) await api.logout().catch(() => undefined);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setTokens(null);
    },
  }), [ready, tokens, serverUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
