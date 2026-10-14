import { Role } from "~/lib/roles";

export type NavArea = {
  to: string;
  label: string;
  roles: readonly Role[];
};

export type ChildNavItem = {
  to: string;
  label: string;
};

const ALL_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Controller,
  Role.Trustee,
  Role.Rider,
  Role.Driver,
];

const MANAGE_BIKE_ROLES: readonly Role[] = [Role.Admin, Role.Trustee];
const MANAGE_OPERATIONS_ROLES: readonly Role[] = [Role.Admin, Role.Trustee];

/**
 * Primary nav areas and which roles may see them.
 * Current screens are Viewer+ (any Plasma role). Later areas such as audit
 * (trustee/admin) should be added here rather than hardcoded in the layout.
 */
export const NAV_AREAS: readonly NavArea[] = [
  { to: "/jobs", label: "Jobs", roles: ALL_ROLES },
  { to: "/shifts", label: "Shifts", roles: ALL_ROLES },
  { to: "/directory", label: "Directory", roles: ALL_ROLES },
  { to: "/bikes", label: "Bikes", roles: MANAGE_BIKE_ROLES },
  {
    to: "/operations",
    label: "Operations",
    roles: MANAGE_OPERATIONS_ROLES,
  },
];

/** Secondary header links shown while browsing an Operations screen. */
export const OPERATIONS_CHILD_NAV: readonly ChildNavItem[] = [
  { to: "/operations/postcode-areas", label: "Postcode areas" },
  { to: "/operations/section-172", label: "Section 172" },
];

const CREATE_JOB_ROLES: readonly Role[] = [Role.Admin, Role.Controller];

export function canManageBikes(role: Role | null): boolean {
  if (!role) {
    return false;
  }

  return MANAGE_BIKE_ROLES.includes(role);
}

export function canManagePostcodeAreas(role: Role | null): boolean {
  if (!role) {
    return false;
  }

  return MANAGE_OPERATIONS_ROLES.includes(role);
}

export function canManageJobs(role: Role | null): boolean {
  return canCreateJobs(role);
}

export function hasPlasmaAccess(roles: readonly Role[]): boolean {
  return roles.length > 0;
}

export function canCreateJobs(role: Role | null): boolean {
  if (!role) {
    return false;
  }

  return CREATE_JOB_ROLES.includes(role);
}

export function needsRoleSelection(
  roles: readonly Role[],
  activeRole: Role | null,
): boolean {
  return roles.length > 1 && activeRole == null;
}

export function navAreasForRole(role: Role | null): NavArea[] {
  if (!role) {
    return [];
  }

  return NAV_AREAS.filter((area) => area.roles.includes(role));
}

export function childNavForPath(pathname: string): readonly ChildNavItem[] {
  if (pathname === "/operations" || pathname.startsWith("/operations/")) {
    return OPERATIONS_CHILD_NAV;
  }

  return [];
}

export function homePathForRole(role: Role | null): string {
  const first = navAreasForRole(role)[0];
  if (!first) {
    return "/no-access";
  }

  return first.to;
}

export function canAccessPath(role: Role | null, pathname: string): boolean {
  if (!role) {
    return false;
  }

  if (pathname === "/dashboard" || pathname === "/select-role") {
    return true;
  }

  return navAreasForRole(role).some(
    (area) => pathname === area.to || pathname.startsWith(`${area.to}/`),
  );
}

export function postAuthPath(
  roles: readonly Role[],
  activeRole: Role | null,
): string {
  if (!hasPlasmaAccess(roles)) {
    return "/no-access";
  }

  if (needsRoleSelection(roles, activeRole)) {
    return "/select-role";
  }

  return homePathForRole(activeRole);
}
