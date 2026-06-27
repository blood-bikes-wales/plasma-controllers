import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "~/components/status-badge";

describe("StatusBadge", () => {
  it("renders badge text", () => {
    render(<StatusBadge>Trustee</StatusBadge>);

    expect(screen.getByText("Trustee")).toBeInTheDocument();
  });

  it("uses active variant styling by default", () => {
    render(<StatusBadge>Active</StatusBadge>);

    expect(screen.getByText("Active")).toHaveClass(
      "bg-bb-status-active-bg",
      "text-bb-status-active-text",
      "border-bb-status-active-border",
    );
  });

  it("applies pending variant styling", () => {
    render(<StatusBadge variant="pending">Pending</StatusBadge>);

    expect(screen.getByText("Pending")).toHaveClass(
      "bg-bb-white",
      "text-bb-gray-700",
      "border-bb-status-pending-border",
    );
  });

  it("applies success variant styling", () => {
    render(<StatusBadge variant="success">Delivered</StatusBadge>);

    expect(screen.getByText("Delivered")).toHaveClass(
      "bg-bb-success-light",
      "text-bb-success",
    );
  });

  it("applies error variant styling", () => {
    render(<StatusBadge variant="error">Failed</StatusBadge>);

    expect(screen.getByText("Failed")).toHaveClass(
      "bg-bb-error-light",
      "text-bb-error",
    );
  });
});
