import { describe, expect, it, vi } from "vitest";

import { createRequestId, REQUEST_ID_HEADER } from "~/lib/request-id";

describe("createRequestId", () => {
  it("returns a UUID when crypto.randomUUID is available", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-3333-4444-555555555555",
    });

    expect(createRequestId()).toBe("11111111-2222-3333-4444-555555555555");
    expect(REQUEST_ID_HEADER).toBe("X-Request-Id");

    vi.unstubAllGlobals();
  });

  it("falls back to a fe- prefixed id without randomUUID", () => {
    vi.stubGlobal("crypto", {});

    expect(createRequestId()).toMatch(/^fe-[a-z0-9]+-[a-z0-9]+$/i);

    vi.unstubAllGlobals();
  });
});
