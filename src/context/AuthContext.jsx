import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [authError, setAuthError] = useState("");

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          setSessionExpired(false);
          setAuthError("");
          return true;
        }
      }
      setUser(null);
      return false;
    } catch {
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listener para quando qualquer requisição API receber 401 durante o uso
  useEffect(() => {
    function handleExpired() {
      setUser((current) => {
        if (current) {
          setSessionExpired(true);
          return null;
        }
        return current;
      });
    }
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  const login = async (username, password) => {
    setAuthError("");
    setSessionExpired(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || "Não foi possível autenticar. Verifique seus dados.";
        setAuthError(msg);
        throw new Error(msg);
      }

      setUser(data.user);
      setSessionExpired(false);
      setAuthError("");
      return data.user;
    } catch (err) {
      if (!authError) setAuthError(err.message || "Falha na comunicação com o servidor.");
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignora falhas de rede no logout
    } finally {
      setUser(null);
      setSessionExpired(false);
      setAuthError("");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sessionExpired,
        setSessionExpired,
        authError,
        setAuthError,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return ctx;
}

