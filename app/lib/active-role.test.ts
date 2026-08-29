import { afterEach, describe, expect, it } from "vitest";

import {
  clearActiveRole,
  getActiveRole,
  setActiveRole,
} from "~/lib/active-role";
import { Role } from "~/lib/roles";

afterEach(() => {
  clearActiveRole();
});

describe("active-role", () => {
  it("stores and clears the session active role", () => {
    expect(getActiveRole()).toBeNull();

    setActiveRole(Role.Trustee);
    expect(getActiveRole()).toBe(Role.Trustee);

    clearActiveRole();
    expect(getActiveRole()).toBeNull();
  });

  it("ignores unknown stored values", () => {
    sessionStorage.setItem("plasma.active_role", "Everyone");
    expect(getActiveRole()).toBeNull();
  });
});
