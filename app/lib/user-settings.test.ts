import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "~/lib/api-client";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { parseUserSettings, saveShowCompletedJobs } from "~/lib/user-settings";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("parseUserSettings", () => {
  it("reads the saved value", () => {
    expect(parseUserSettings({ showCompletedJobs: true })).toEqual({
      showCompletedJobs: true,
    });
    expect(parseUserSettings({ showCompletedJobs: false })).toEqual({
      showCompletedJobs: false,
    });
  });

  it.each([
    undefined,
    null,
    "yes",
    [],
    {},
    { showCompletedJobs: "true" },
  ])("falls back to the defaults for %j", (value) => {
    expect(parseUserSettings(value)).toEqual({ showCompletedJobs: false });
  });
});

describe("saveShowCompletedJobs", () => {
  it("PATCHes /me and returns the saved settings", async () => {
    setAuthToken("test-token");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ id: "u1", settings: { showCompletedJobs: true } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveShowCompletedJobs(true)).resolves.toEqual({
      showCompletedJobs: true,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/me$/);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ showCompletedJobs: true });
  });

  it("rejects when the API refuses it", async () => {
    setAuthToken("test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Nope" }), {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(saveShowCompletedJobs(true)).rejects.toBeInstanceOf(ApiError);
  });
});
