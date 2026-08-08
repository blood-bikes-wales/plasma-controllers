import { afterEach, describe, expect, it, vi } from "vitest";

import { type ApiError, apiFetch } from "~/lib/api-client";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
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
});
