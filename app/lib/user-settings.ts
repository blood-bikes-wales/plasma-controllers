import { apiFetch } from "~/lib/api-client";

/**
 * Per-user preferences stored on the API (`settings` on GET/PATCH /me). They
 * follow the signed-in user across sessions and browsers, which is why they
 * are not kept in localStorage or sessionStorage.
 */
export type UserSettings = {
  /** List completed jobs older than 24 hours on the Completed tab too. */
  showCompletedJobs: boolean;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  showCompletedJobs: false,
};

/**
 * Read `settings` from a /me payload. An API that predates settings sends none
 * (and a user with no saved setting is false), so anything unexpected falls
 * back to the defaults instead of crashing.
 */
export function parseUserSettings(value: unknown): UserSettings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_USER_SETTINGS };
  }

  const { showCompletedJobs } = value as Record<string, unknown>;

  return {
    showCompletedJobs:
      typeof showCompletedJobs === "boolean"
        ? showCompletedJobs
        : DEFAULT_USER_SETTINGS.showCompletedJobs,
  };
}

/** PATCH /me for the signed-in user; resolves to the settings the API saved. */
export async function saveShowCompletedJobs(
  showCompletedJobs: boolean,
): Promise<UserSettings> {
  const profile = await apiFetch<{ settings?: unknown }>("/me", {
    method: "PATCH",
    body: JSON.stringify({ showCompletedJobs }),
  });

  return parseUserSettings(profile?.settings);
}
