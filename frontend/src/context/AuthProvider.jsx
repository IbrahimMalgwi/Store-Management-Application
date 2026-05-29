import { useEffect, useState } from "react";
import { api } from "../services/api";
import { AuthContext } from "./authContext";

const readStoredUser = () => {
  const token = localStorage.getItem("token");
  const refreshToken = localStorage.getItem("refreshToken");
  const storedUser = localStorage.getItem("user");

  if (!token || !refreshToken || !storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    clearStoredSession();
    return null;
  }
};

const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("refreshTokenExpiresAt");
  localStorage.removeItem("user");
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);

  useEffect(() => {
    const handleExpired = () => {
      clearStoredSession();
      setUser(null);
    };
    const handleRefreshed = (event) => {
      setUser(event.detail);
    };

    window.addEventListener("auth:session-expired", handleExpired);
    window.addEventListener("auth:session-refreshed", handleRefreshed);

    return () => {
      window.removeEventListener("auth:session-expired", handleExpired);
      window.removeEventListener("auth:session-refreshed", handleRefreshed);
    };
  }, []);

  const login = async (email, password) => {
    const data = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("refreshTokenExpiresAt", data.refreshTokenExpiresAt);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch {
      // Local logout should continue even if the server session is already gone.
    }
    clearStoredSession();
    setUser(null);
  };

  const updateUser = (nextUser) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
