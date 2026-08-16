/** Matches plasma-api AssignRequestId::HEADER. */
export const REQUEST_ID_HEADER = "X-Request-Id";

/**
 * Generate a request / correlation ID safe for the API (UUID preferred).
 */
export function createRequestId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
