import { Role } from "~/lib/roles";

export type NavArea = {
  to: string;
  label: string;
  roles: readonly Role[];
};

const ALL_ROLES: readonly Role[] = [
  Role.Admin,
  Role.Controller,
  Role.Trustee,
  Role.Rider,
  Role.Driver,
];

/**
 * Primary nav areas and which roles may see them.
 * Current screens are Viewer+ (any Plasma role). Later areas such as audit
 * (trustee/admin) should be added here rather than hardcoded in the layout.
 */
export const NAV_AREAS: readonly NavArea[] = [
  { to: "/jobs", label: "Jobs", roles: ALL_ROLES },
  { to: "/shifts", label: "Shifts", roles: ALL_ROLES },
];

export function hasPlasmaAccess(roles: readonly Role[]): boolean {
  return roles.length > 0;
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
