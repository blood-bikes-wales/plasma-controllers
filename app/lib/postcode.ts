/**
 * UK postcode, e.g. "CF14 4XW", "SA1 1AA", "SW1A 1AA". The space is optional
 * and the match must not be glued to neighbouring letters or digits.
 */
const UK_POSTCODE_PATTERN =
  /(?:^|[^A-Za-z0-9])([A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2})(?![A-Za-z0-9])/;

/** The first UK postcode written in free text, or null. */
export function findUkPostcode(text: string): string | null {
  const match = UK_POSTCODE_PATTERN.exec(text);
  return match ? match[1].toUpperCase() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `address` already prints `postcode` (ignoring case and spaces). */
export function addressContainsPostcode(
  address: string,
  postcode: string,
): boolean {
  const compact = postcode.replace(/\s+/g, "");
  if (compact.length === 0) {
    return false;
  }

  // Let any run of spaces sit between the characters, but keep the postcode
  // from matching inside a longer code (e.g. "N1 1AA" inside "BN1 1AA").
  const body = [...compact].map(escapeRegExp).join("\\s*");
  return new RegExp(`(?:^|[^A-Za-z0-9])${body}(?![A-Za-z0-9])`, "i").test(
    address,
  );
}

/**
 * The postcode to print after `address`, or null when there is none or the
 * address text already contains it. This is the one dedupe rule for every
 * screen that shows a place.
 */
export function postcodeToShow(
  address: string,
  postcode: string | null | undefined,
): string | null {
  const trimmed = postcode?.trim();
  if (!trimmed || addressContainsPostcode(address, trimmed)) {
    return null;
  }

  return trimmed;
}

/** `address` followed by its postcode, unless the address already has it. */
export function addressWithPostcode(
  address: string,
  postcode: string | null | undefined,
): string {
  const extra = postcodeToShow(address, postcode);
  return extra ? `${address}, ${extra}` : address;
}
