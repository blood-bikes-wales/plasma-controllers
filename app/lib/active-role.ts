import { isRole, type Role } from "~/lib/roles";

const ACTIVE_ROLE_KEY = "plasma.active_role";

export function getActiveRole(): Role | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const stored = sessionStorage.getItem(ACTIVE_ROLE_KEY);
  if (!stored || !isRole(stored)) {
    return null;
  }

  return stored;
}

export function setActiveRole(role: Role): void {
  sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
}

export function clearActiveRole(): void {
  sessionStorage.removeItem(ACTIVE_ROLE_KEY);
}
