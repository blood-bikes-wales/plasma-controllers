import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BereavementBadge } from "~/components/bereavement-badge";

describe("BereavementBadge", () => {
  it("shows an icon and the plain word Bereavement when set", () => {
    const { container } = render(
      <BereavementBadge job={{ isBereavement: true }} />,
    );

    const badge = screen.getByText("Bereavement");
    expect(badge).toBeInTheDocument();
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses navy tokens and never red or error colours", () => {
    render(<BereavementBadge job={{ isBereavement: true }} />);

    const classes = screen.getByText("Bereavement").className;
    expect(classes).toContain("text-bb-navy");
    expect(classes).toContain("bg-bb-navy/10");
    // Exact class names: the default variant's `[a]:hover:bg-primary/80` is only for links.
    const names = classes.split(/\s+/);
    expect(names).not.toContain("bg-primary");
    expect(names).not.toContain("bg-destructive");
    expect(classes).not.toMatch(
      /(^|\s)(dark:)?(bg|text|border)-(red|destructive|bb-error|bb-primary|bb-cta|bb-warning)/,
    );
  });

  it.each([
    ["false", { isBereavement: false }],
    ["absent", {}],
  ])("renders nothing when the flag is %s", (_label, job) => {
    const { container } = render(<BereavementBadge job={job} />);

    expect(container).toBeEmptyDOMElement();
  });
});
