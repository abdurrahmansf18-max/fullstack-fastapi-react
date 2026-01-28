// frontend/src/shared/hooks/useAdminAuth.ts
import { useCallback, useEffect, useState } from "react";
import { AdminAuth } from "../api/admin";
import { getAdminToken, setAdminToken } from "../api/client";

export function useAdminAuth() {
  const [token, setTokenState] = useState<string | null>(getAdminToken());
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // localStorage güncelle
  useEffect(() => {
    setAdminToken(token ?? null);
  }, [token]);

  const login = useCallback(async (username: string, password: string): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const data = await AdminAuth.login(username, password);
      setTokenState(data.access_token);
      return data.access_token; // ✅ başarıda token dön
    } catch (e: any) {
      const msg = e?.message || "Giriş başarısız.";
      setError(msg);
      setTokenState(null);
      throw new Error(msg);      // ✅ UI try/catch ile yakalasın (toast vs.)
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setTokenState(null);
    setAdminToken(null);
  }, []);

  return { token, loading, error, login, logout };
}
