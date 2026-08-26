import type { z } from "zod";

/**
 * Reduces a failed zod `safeParse` result to the first error message per
 * top-level field, keyed by field name, for simple inline form display.
 */
export function fieldErrors<T>(
  result: z.ZodSafeParseResult<T>,
): Record<string, string> {
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
