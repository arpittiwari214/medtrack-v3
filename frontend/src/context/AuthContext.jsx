// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../api/index";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("mt_user")); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // On mount — verify stored token is still valid
  useEffect(() => {
    const token = localStorage.getItem("mt_token");
    if (!token) { setLoading(false); return; }
    authAPI.me()
      .then(res => {
        setUser(res.data.user);
        localStorage.setItem("mt_user", JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem("mt_token");
        localStorage.removeItem("mt_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    localStorage.setItem("mt_token", res.data.token);
    localStorage.setItem("mt_user",  JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const signup = async (name, email, password, age) => {
    const res = await authAPI.signup({ name, email, password, age });
    localStorage.setItem("mt_token", res.data.token);
    localStorage.setItem("mt_user",  JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem("mt_token");
    localStorage.removeItem("mt_user");
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await authAPI.me();
    setUser(res.data.user);
    localStorage.setItem("mt_user", JSON.stringify(res.data.user));
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
