import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "./api";
import type { User } from "./types";

const Context = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setUser((await api<{ user: User }>("/auth/me")).user);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    const expired = () => setUser(null);
    window.addEventListener("rahma:session-ended", expired);
    return () => window.removeEventListener("rahma:session-ended", expired);
  }, []);
  async function signIn(email: string, password: string) {
    setUser(
      (
        await api<{ user: User }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
      ).user,
    );
  }
  async function signOut() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
    setUser(null);
  }
  return (
    <Context.Provider
      value={{ user, loading, error, refresh, signIn, signOut, setUser }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing AuthProvider");
  return value;
}
