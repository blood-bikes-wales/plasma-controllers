import { describe, expect, it } from "vitest";

import {
  isRole,
  parseRoles,
  primaryRole,
  primaryRoleLabel,
  Role,
  roleLabel,
} from "~/lib/roles";

describe("Role", () => {
  it("exposes API string values", () => {
    expect(Role.Admin).toBe("admin");
    expect(Role.Controller).toBe("controller");
    expect(Role.Trustee).toBe("trustee");
  });

  it("isRole accepts known values only", () => {
    expect(isRole("controller")).toBe(true);
    expect(isRole("Everyone")).toBe(false);
  });

  it("parseRoles drops unknown values", () => {
    expect(parseRoles(["rider", "Everyone", "driver"])).toEqual([
      Role.Rider,
      Role.Driver,
    ]);
    expect(parseRoles()).toEqual([]);
    expect(parseRoles(null)).toEqual([]);
  });

  it("roleLabel capitalizes known roles", () => {
    expect(roleLabel(Role.Trustee)).toBe("Trustee");
  });
});

describe("primaryRole", () => {
  it("returns null when membership is empty", () => {
    expect(primaryRole()).toBeNull();
    expect(primaryRole([])).toBeNull();
  });

  it("prefers controller when present among multiple roles", () => {
    expect(primaryRole([Role.Rider, Role.Controller, Role.Admin])).toBe(
      Role.Controller,
    );
  });
});

describe("primaryRoleLabel", () => {
  it("prefers controller when present among multiple roles", () => {
    expect(primaryRoleLabel([Role.Rider, Role.Controller, Role.Admin])).toBe(
      "Controller",
    );
  });

  it("falls back to admin, then trustee, then rider, then driver", () => {
    expect(primaryRoleLabel([Role.Admin, Role.Rider])).toBe("Admin");
    expect(primaryRoleLabel([Role.Trustee, Role.Rider])).toBe("Trustee");
    expect(primaryRoleLabel([Role.Rider])).toBe("Rider");
    expect(primaryRoleLabel([Role.Driver])).toBe("Driver");
  });

  it("defaults to Controller when roles are missing or empty", () => {
    expect(primaryRoleLabel()).toBe("Controller");
    expect(primaryRoleLabel([])).toBe("Controller");
  });
});
