import { afterEach, describe, expect, it } from "vitest";

import { clearAuthToken, getAuthToken, setAuthToken } from "~/lib/auth-token";

afterEach(() => {
  clearAuthToken();
});

describe("auth-token", () => {
  it("stores and clears the Google ID token in sessionStorage", () => {
    expect(getAuthToken()).toBeNull();

    setAuthToken("abc.def.ghi");
    expect(getAuthToken()).toBe("abc.def.ghi");

    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});
