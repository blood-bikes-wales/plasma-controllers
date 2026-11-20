import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  apiFieldErrors,
  fieldErrors,
  isUkPhoneNumber,
  UK_PHONE_MESSAGE,
  ukPhoneSchema,
} from "./validation";

const schema = z.object({
  name: z.string().min(1, "Enter a name"),
  age: z.string().min(1, "Enter an age"),
});

describe("fieldErrors", () => {
  it("returns no errors for a successful parse", () => {
    const result = schema.safeParse({ name: "Sarah", age: "30" });

    expect(fieldErrors(result)).toEqual({});
  });

  it("maps each failing field to its first error message", () => {
    const result = schema.safeParse({ name: "", age: "" });

    expect(fieldErrors(result)).toEqual({
      name: "Enter a name",
      age: "Enter an age",
    });
  });

  it("keeps only the first message when a field has multiple issues", () => {
    const multiIssueSchema = z.object({
      value: z
        .string()
        .min(1, "Enter a value")
        .superRefine((value, ctx) => {
          if (value === "") {
            ctx.addIssue({ code: "custom", message: "Second issue" });
          }
        }),
    });

    const result = multiIssueSchema.safeParse({ value: "" });

    expect(fieldErrors(result)).toEqual({ value: "Enter a value" });
  });
});

describe("apiFieldErrors", () => {
  it("returns no errors when the body has no errors map", () => {
    expect(apiFieldErrors({ message: "Invalid" })).toEqual({});
    expect(apiFieldErrors(null)).toEqual({});
  });

  it("maps nested Laravel keys onto form field names", () => {
    expect(
      apiFieldErrors({
        message: "The given data was invalid.",
        errors: {
          "sender.name": ["Enter the caller's name"],
          "sender.phone": ["Enter a contact number"],
          "sender.organisation": ["Organisation is too long."],
          "collection.placeId": [
            "Collection location must include a Google Place ID.",
          ],
          "delivery.address": ["Delivery location must include an address."],
          contents: ["Describe the item or contents"],
          "serviceAreas.0": ["Choose at least one service area"],
        },
      }),
    ).toEqual({
      senderName: "Enter the caller's name",
      senderPhone: "Enter a contact number",
      senderOrganisation: "Organisation is too long.",
      collection: "Collection location must include a Google Place ID.",
      delivery: "Delivery location must include an address.",
      contents: "Describe the item or contents",
      serviceAreas: "Choose at least one service area",
    });
  });

  it("keeps the first message when a field is reported twice", () => {
    expect(
      apiFieldErrors({
        errors: {
          "collection.placeId": ["Choose a place"],
          "collection.address": ["Choose an address"],
        },
      }),
    ).toEqual({ collection: "Choose a place" });
  });
});

describe("ukPhoneSchema", () => {
  it.each([
    "02920747747",
    "029 2074 7747",
    "+44 29 2074 7747",
    "07700 900101",
    "(029) 2074-7747",
    "0800 123 456",
    "  029 2074 7747  ",
  ])("accepts %j", (input) => {
    expect(isUkPhoneNumber(input)).toBe(true);
    expect(ukPhoneSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    "abc",
    "123",
    "0292074774712345",
    "",
    "029 2074 77AB",
    "029207477",
    "029207477471",
    "2920747747",
    "+1 202 555 0143",
  ])("rejects %j with the UK phone message", (input) => {
    expect(isUkPhoneNumber(input)).toBe(false);

    const result = ukPhoneSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(UK_PHONE_MESSAGE);
  });

  it("returns the trimmed number unchanged otherwise", () => {
    expect(ukPhoneSchema.parse("  +44 29 2074 7747 ")).toBe("+44 29 2074 7747");
  });
});

describe("apiFieldErrors for job types", () => {
  it("lands milkLitres and jobType errors on their own fields", () => {
    expect(
      apiFieldErrors({
        errors: {
          milkLitres: ["Enter how many litres of milk are being collected."],
          jobType: ["The selected job type is invalid."],
        },
      }),
    ).toEqual({
      milkLitres: "Enter how many litres of milk are being collected.",
      jobType: "The selected job type is invalid.",
    });
  });
});
