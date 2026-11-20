import { describe, expect, it } from "vitest";

import {
  addressContainsPostcode,
  addressWithPostcode,
  findUkPostcode,
  postcodeToShow,
} from "~/lib/postcode";

describe("findUkPostcode", () => {
  it.each([
    ["Royal Glamorgan Hospital, Llantrisant CF72 8XR, UK", "CF72 8XR"],
    ["Somewhere, Swansea sa61aa", "SA61AA"],
    ["10 Downing Street, London SW1A 1AA", "SW1A 1AA"],
  ])("finds the postcode in %s", (text, expected) => {
    expect(findUkPostcode(text)).toBe(expected);
  });

  it("returns null when the text has no postcode", () => {
    expect(findUkPostcode("University Hospital of Wales, Cardiff")).toBeNull();
    expect(findUkPostcode("Room 1234 Heath Park")).toBeNull();
  });
});

describe("addressContainsPostcode", () => {
  it("ignores case and spaces", () => {
    expect(addressContainsPostcode("Llantrisant cf728xr, UK", "CF72 8XR")).toBe(
      true,
    );
    expect(addressContainsPostcode("Llantrisant CF72 8XR", "cf728xr")).toBe(
      true,
    );
  });

  it("does not match a postcode that is only part of a longer one", () => {
    expect(addressContainsPostcode("Brighton BN1 1AA", "N1 1AA")).toBe(false);
  });

  it("is false when the postcode is not in the address", () => {
    expect(addressContainsPostcode("Cardiff CF14 4XW", "CF72 8XR")).toBe(false);
  });
});

describe("postcodeToShow", () => {
  it("returns the trimmed postcode when the address does not have it", () => {
    expect(postcodeToShow("Royal Glamorgan Hospital", " CF72 8XR ")).toBe(
      "CF72 8XR",
    );
  });

  it("returns null when the address already has it", () => {
    expect(postcodeToShow("Llantrisant CF72 8XR, UK", "cf728xr")).toBeNull();
  });

  it.each([null, undefined, "", "   "])("returns null for %j", (postcode) => {
    expect(postcodeToShow("Royal Glamorgan Hospital", postcode)).toBeNull();
  });
});

describe("addressWithPostcode", () => {
  it("appends the postcode after the address", () => {
    expect(addressWithPostcode("Royal Glamorgan Hospital", "CF72 8XR")).toBe(
      "Royal Glamorgan Hospital, CF72 8XR",
    );
  });

  it("leaves the address alone when it already has the postcode", () => {
    expect(addressWithPostcode("Llantrisant CF72 8XR, UK", "CF72 8XR")).toBe(
      "Llantrisant CF72 8XR, UK",
    );
    expect(addressWithPostcode("Royal Glamorgan Hospital", null)).toBe(
      "Royal Glamorgan Hospital",
    );
  });
});
