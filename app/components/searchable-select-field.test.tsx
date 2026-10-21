import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchableSelectField } from "./searchable-select-field";

const OPTIONS = [
  { value: "r1", label: "Sarah Jones" },
  { value: "r3", label: "Emma Williams" },
];

describe("SearchableSelectField", () => {
  it("lists matching options while searching and keeps the selected label", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(
      <SearchableSelectField
        id="rider"
        label="Rider"
        value={null}
        onChange={onChange}
        options={OPTIONS}
        placeholder="Search or select rider…"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Rider" }));
    expect(screen.getByRole("option", { name: "Sarah Jones" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Emma Williams" }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("combobox", { name: "Rider" }), "emma");
    expect(
      screen.queryByRole("option", { name: "Sarah Jones" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Emma Williams" }));

    expect(onChange).toHaveBeenCalledWith("r3");

    rerender(
      <SearchableSelectField
        id="rider"
        label="Rider"
        value="r3"
        onChange={onChange}
        options={OPTIONS}
        placeholder="Search or select rider…"
      />,
    );

    expect(screen.getByDisplayValue("Emma Williams")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("clears the selection when Change is pressed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableSelectField
        id="rider"
        label="Rider"
        value="r1"
        onChange={onChange}
        options={OPTIONS}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows an empty message when there are no options", () => {
    render(
      <SearchableSelectField
        id="rider"
        label="Rider"
        value={null}
        onChange={() => {}}
        options={[]}
        emptyMessage="Every rider is already on shift."
      />,
    );

    expect(
      screen.getByText("Every rider is already on shift."),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Rider" })).toBeDisabled();
  });
});
