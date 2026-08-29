import { describe, expect, it } from "vitest";

import {
  canAccessPath,
  canCreateJobs,
  hasPlasmaAccess,
  homePathForRole,
  navAreasForRole,
  needsRoleSelection,
  postAuthPath,
} from "~/lib/capabilities";
import { Role } from "~/lib/roles";

describe("hasPlasmaAccess", () => {
  it("is true only when the user has at least one Plasma role", () => {
    expect(hasPlasmaAccess([])).toBe(false);
    expect(hasPlasmaAccess([Role.Rider])).toBe(true);
  });
});

describe("canCreateJobs", () => {
  it("allows coordinator and administrator only", () => {
    expect(canCreateJobs(Role.Controller)).toBe(true);
    expect(canCreateJobs(Role.Admin)).toBe(true);
    expect(canCreateJobs(Role.Rider)).toBe(false);
    expect(canCreateJobs(Role.Trustee)).toBe(false);
    expect(canCreateJobs(Role.Driver)).toBe(false);
    expect(canCreateJobs(null)).toBe(false);
  });
});

describe("needsRoleSelection", () => {
  it("requires a choice when membership has multiple roles and none is active", () => {
    expect(needsRoleSelection([Role.Controller, Role.Trustee], null)).toBe(
      true,
    );
    expect(
      needsRoleSelection([Role.Controller, Role.Trustee], Role.Trustee),
    ).toBe(false);
    expect(needsRoleSelection([Role.Controller], null)).toBe(false);
  });
});

describe("navAreasForRole", () => {
  it("returns jobs, shifts, and directory for every Plasma role", () => {
    expect(navAreasForRole(Role.Rider).map((area) => area.to)).toEqual([
      "/jobs",
      "/shifts",
      "/directory",
    ]);
    expect(navAreasForRole(Role.Admin).map((area) => area.label)).toEqual([
      "Jobs",
      "Shifts",
      "Directory",
    ]);
  });

  it("returns no areas without an active role", () => {
    expect(navAreasForRole(null)).toEqual([]);
  });
});

describe("homePathForRole", () => {
  it("sends users with a role to jobs and others to no-access", () => {
    expect(homePathForRole(Role.Controller)).toBe("/jobs");
    expect(homePathForRole(null)).toBe("/no-access");
  });
});

describe("canAccessPath", () => {
  it("allows jobs nested routes and dashboard for a role", () => {
    expect(canAccessPath(Role.Controller, "/jobs")).toBe(true);
    expect(canAccessPath(Role.Controller, "/jobs/new")).toBe(true);
    expect(canAccessPath(Role.Controller, "/directory")).toBe(true);
    expect(canAccessPath(Role.Controller, "/dashboard")).toBe(true);
    expect(canAccessPath(Role.Controller, "/select-role")).toBe(true);
  });

  it("denies app areas without an active role", () => {
    expect(canAccessPath(null, "/jobs")).toBe(false);
  });
});

describe("postAuthPath", () => {
  it("sends no-role users to no-access", () => {
    expect(postAuthPath([], null)).toBe("/no-access");
  });

  it("sends multi-role users without a session choice to select-role", () => {
    expect(postAuthPath([Role.Controller, Role.Trustee], null)).toBe(
      "/select-role",
    );
  });

  it("sends users with an active role home", () => {
    expect(postAuthPath([Role.Controller], Role.Controller)).toBe("/jobs");
  });
});
