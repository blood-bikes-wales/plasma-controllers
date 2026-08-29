import { clearAuthToken, getAuthToken } from "~/lib/auth-token";
import { getApiBaseUrl } from "~/lib/env";
import { createRequestId, REQUEST_ID_HEADER } from "~/lib/request-id";

export const UNAUTHORIZED_EVENT = "plasma:unauthorized";

type ApiErrorOptions = {
  body?: unknown;
  requestId?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;
  readonly requestId?: string;

  constructor(status: number, message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = options.body;
    this.requestId = options.requestId;
  }
}

type RequestOptions = RequestInit & {
  /** When set, use this token instead of the stored session token. */
  token?: string | null;
  /** Skip Authorization header entirely. */
  skipAuth?: boolean;
  /** Override the generated X-Request-Id (tests / explicit correlation). */
  requestId?: string;
};

function notifyUnauthorized(): void {
  clearAuthToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

function parseJsonBody(
  text: string,
  status: number,
  requestId: string,
): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(status, `Request failed with status ${status}`, {
      requestId,
    });
  }
}

function errorMessageFromBody(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  return `Request failed with status ${status}`;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    token,
    skipAuth,
    requestId: requestIdOption,
    headers: initHeaders,
    ...init
  } = options;
  const headers = new Headers(initHeaders);

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestId =
    requestIdOption ?? headers.get(REQUEST_ID_HEADER) ?? createRequestId();
  headers.set(REQUEST_ID_HEADER, requestId);

  if (!skipAuth) {
    // `undefined` → session token; explicit `null` → no Bearer header.
    const bearer = token === undefined ? getAuthToken() : token;
    if (bearer) {
      headers.set("Authorization", `Bearer ${bearer}`);
    }
  }

  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    notifyUnauthorized();
    throw new ApiError(401, "Unauthenticated", { requestId });
  }

  const text = await response.text();
  const body = text ? parseJsonBody(text, response.status, requestId) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      errorMessageFromBody(body, response.status),
      {
        body,
        requestId,
      },
    );
  }

  return body as T;
}
