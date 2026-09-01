type ParseFailure = {
  success: false;
  error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };
};

type ParseResult<T> = { success: true; data: T } | ParseFailure;

/**
 * Reduces a failed zod `safeParse` result to the first error message per
 * top-level field, keyed by field name, for simple inline form display.
 */
export function fieldErrors<T>(result: ParseResult<T>): Record<string, string> {
  if (result.success) {
    return {};
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in errors)) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

const API_FIELD_MAP: Record<string, string> = {
  "sender.name": "senderName",
  "sender.phone": "senderPhone",
  "sender.organisation": "senderOrganisation",
  contents: "contents",
  serviceAreas: "serviceAreas",
  registration: "registration",
  area: "area",
  lastRecordedMileage: "lastRecordedMileage",
  last_recorded_mileage: "lastRecordedMileage",
  purchasedAt: "purchasedAt",
  purchased_at: "purchasedAt",
};

function formFieldForApiKey(key: string): string {
  const mapped = API_FIELD_MAP[key];
  if (mapped) {
    return mapped;
  }

  if (key.startsWith("collection")) {
    return "collection";
  }

  if (key.startsWith("delivery")) {
    return "delivery";
  }

  if (key.startsWith("serviceAreas")) {
    return "serviceAreas";
  }

  return key;
}

function firstErrorMessage(messages: unknown): string | null {
  if (!Array.isArray(messages)) {
    return null;
  }

  const [first] = messages;
  if (typeof first !== "string" || first.length === 0) {
    return null;
  }

  return first;
}

/**
 * Maps a Laravel 422 `{ errors: { "collection.placeId": ["…"] } }` body onto
 * top-level form field names used by the new-job drawer.
 */
export function apiFieldErrors(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return {};
  }

  const { errors } = body as { errors: unknown };
  if (typeof errors !== "object" || errors === null) {
    return {};
  }

  const mapped: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const field = formFieldForApiKey(key);
    if (field in mapped) {
      continue;
    }

    const message = firstErrorMessage(messages);
    if (!message) {
      continue;
    }

    mapped[field] = message;
  }

  return mapped;
}
