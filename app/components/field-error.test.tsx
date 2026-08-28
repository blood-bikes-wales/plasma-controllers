import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldError } from "./field-error";

describe("FieldError", () => {
  it("renders nothing when there is no message", () => {
    const { container } = render(<FieldError />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message as an alert", () => {
    render(<FieldError message="Enter a value" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value");
  });
});
