// src/api/client.js
// Low-level HTTP wrapper. Components never import this directly;
// they go through api.js.

const BASE_URL = import.meta.env.VITE_API_URL || "/api";
const DEFAULT_TIMEOUT_MS = 10000;

// Custom error so the UI can show useful messages
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status; // HTTP status, or 0 for network/timeout errors
    this.data = data;     // error body from the server, if any
  }
}

// Placeholder for login later. Swap in real token storage when auth exists.
function getAuthToken() {
  return null;
}

async function request(path, { method = "GET", body, params, timeout = DEFAULT_TIMEOUT_MS } = {}) {
  // Build URL with optional query params, e.g. { scenarioId: 3 } -> ?scenarioId=3
  const url = new URL(BASE_URL + path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, value);
    });
  }

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Abort the request if it takes too long
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError("Request timed out", 0);
    }
    throw new ApiError("Network error: could not reach the server", 0);
  } finally {
    clearTimeout(timer);
  }

  // 204 No Content has no body to parse
  if (response.status === 204) return null;

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    const message = data?.detail || data?.message || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export const client = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};