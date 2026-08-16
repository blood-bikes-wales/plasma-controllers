/** Plasma roles returned by GET /me (matches plasma-api Role enum values). */
export enum Role {
  Admin = "admin",
  Controller = "controller",
  Driver = "driver",
  Rider = "rider",
  Trustee = "trustee",
}

const ROLE_VALUES = new Set<string>(Object.values(Role));

const ROLE_LABELS: Record<Role, string> = {
  [Role.Admin]: "Admin",
  [Role.Controller]: "Controller",
  [Role.Driver]: "Driver",
  [Role.Rider]: "Rider",
  [Role.Trustee]: "Trustee",
};

/** Prefer controller when present; otherwise the next preferred role; else Controller. */
const PREFERRED_ROLES: readonly Role[] = [
  Role.Controller,
  Role.Admin,
  Role.Trustee,
  Role.Rider,
  Role.Driver,
];

export function isRole(value: string): value is Role {
  return ROLE_VALUES.has(value);
}

/** Keep only known Plasma roles from an API payload. */
export function parseRoles(values?: string[] | null): Role[] {
  if (!values?.length) {
    return [];
  }

  return values.filter(isRole);
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function primaryRoleLabel(roles?: Role[]): string {
  if (!roles?.length) {
    return ROLE_LABELS[Role.Controller];
  }

  for (const role of PREFERRED_ROLES) {
    if (roles.includes(role)) {
      return ROLE_LABELS[role];
    }
  }

  return ROLE_LABELS[roles[0] ?? Role.Controller];
}
