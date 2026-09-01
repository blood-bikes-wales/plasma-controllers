import { describe, expect, it } from "vitest";

import { createBikeFormSchema, updateBikeFormSchema } from "~/lib/bikes";

describe("createBikeFormSchema", () => {
  it("accepts valid create input", () => {
    const result = createBikeFormSchema.safeParse({
      registration: "CF12 ABC",
      area: "South",
      lastRecordedMileage: "12000",
      purchasedAt: "2024-03-15",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    expect(result.data.registration).toBe("CF12 ABC");
    expect(result.data.lastRecordedMileage).toBe(12000);
  });

  it("rejects missing required fields", () => {
    const result = createBikeFormSchema.safeParse({
      registration: "",
      area: "South",
      lastRecordedMileage: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid area and negative mileage", () => {
    const result = createBikeFormSchema.safeParse({
      registration: "CF12 ABC",
      area: "East",
      lastRecordedMileage: "-5",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateBikeFormSchema", () => {
  it("accepts valid update input", () => {
    const result = updateBikeFormSchema.safeParse({
      registration: "CF34 DEF",
      area: "North",
      purchasedAt: "",
    });

    expect(result.success).toBe(true);
  });
});
