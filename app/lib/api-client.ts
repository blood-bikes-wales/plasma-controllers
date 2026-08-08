import { clearAuthToken, getAuthToken } from "~/lib/auth-token";
import { getApiBaseUrl } from "~/lib/env";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = RequestInit & {
  /** When set, use this token instead of the stored session token. */
  token?: string | null;
  /** Skip Authorization header entirely. */
  skipAuth?: boolean;
};

function redirectToLogin(): void {
  clearAuthToken();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { token, skipAuth, headers: initHeaders, ...init } = options;
  const headers = new Headers(initHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!skipAuth) {
    const bearer = token === undefined ? getAuthToken() : token;
    if (bearer) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }
  }

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Unauthenticated");
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message, body);
  }

  return body as T;
}
