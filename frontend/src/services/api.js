const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

const getBaseUrl = () => API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
const getPath = (endpoint) => endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

let refreshPromise = null;

const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("refreshTokenExpiresAt");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth:session-expired"));
};

const shouldRefresh = (endpoint, response, data) => {
  if (endpoint.startsWith("/auth/login") || endpoint.startsWith("/auth/refresh")) return false;
  if (![401, 403].includes(response.status)) return false;
  return /expired|access token|required|invalid/i.test(data.message || "");
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${getBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Session expired");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("refreshTokenExpiresAt", data.refreshTokenExpiresAt);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new CustomEvent("auth:session-refreshed", { detail: data.user }));
      return data.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const request = async (endpoint, options = {}, retry = true) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const base = getBaseUrl();
  const path = getPath(endpoint);

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok && retry && shouldRefresh(path, response, data)) {
    try {
      await refreshAccessToken();
      return request(endpoint, options, false);
    } catch {
      clearStoredSession();
    }
  }

  if (!response.ok) {
    throw new Error(data.message || `API error: ${response.status}`);
  }

  return data;
};

export const api = {
  get: (endpoint) => request(endpoint, { method: "GET" }),
  post: (endpoint, body) => request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" }),
};
