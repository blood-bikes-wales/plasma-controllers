import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldErrors } from "./validation";

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
