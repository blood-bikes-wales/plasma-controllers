import { afterEach, describe, expect, it, vi } from "vitest";

import { type ApiError, apiFetch, UNAUTHORIZED_EVENT } from "~/lib/api-client";
import { clearAuthToken, getAuthToken, setAuthToken } from "~/lib/auth-token";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("sends a generated X-Request-Id on every request", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me", { skipAuth: true });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("X-Request-Id")).toBe(
      "aaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
  });

  it("allows an explicit requestId override", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me", { skipAuth: true, requestId: "spa-journey-1" });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("X-Request-Id")).toBe("spa-journey-1");
  });

  it("sets Content-Type JSON when sending a body", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/shifts/logon", {
      skipAuth: true,
      method: "POST",
      body: JSON.stringify({ riderId: "100001" }),
    });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("attaches requestId to ApiError on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await expect(
      apiFetch("/me", { token: "x", requestId: "err-id-9" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      requestId: "err-id-9",
    } satisfies Partial<ApiError>);
  });

  it("attaches the Bearer token from sessionStorage", async () => {
    setAuthToken("stored-token");
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me");

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer stored-token");
  });

  it("uses an explicit token when provided", async () => {
    setAuthToken("stored-token");
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/me", { token: "google-id-token" });

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer google-id-token");
  });

  it("throws ApiError on non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await expect(apiFetch("/me", { token: "x" })).rejects.toMatchObject({
      name: "ApiError",
      status: 403,
      message: "Forbidden",
    } satisfies Partial<ApiError>);
  });

  it("clears the token and notifies listeners on 401", async () => {
    setAuthToken("expired-token");
    const onUnauthorized = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Unauthenticated." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    await expect(apiFetch("/me")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });

    expect(getAuthToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledOnce();

    window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  });
});
