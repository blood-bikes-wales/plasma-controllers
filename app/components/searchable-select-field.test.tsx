import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(
      screen.getByRole("option", { name: "Sarah Jones" }),
    ).toBeInTheDocument();
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

  describe("keyboard", () => {
    function renderEmpty(onChange = vi.fn()) {
      render(
        <SearchableSelectField
          id="rider"
          label="Rider"
          value={null}
          onChange={onChange}
          options={OPTIONS}
        />,
      );
      return { onChange, box: screen.getByRole("combobox", { name: "Rider" }) };
    }

    it("selects nothing when Enter is pressed on an empty box", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{Enter}");
      await user.type(box, "   {Enter}");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("still selects the highlighted option with ArrowDown then Enter", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowDown}{ArrowDown}");
      expect(
        screen.getByRole("option", { name: "Emma Williams" }),
      ).toHaveAttribute("aria-selected", "true");
      expect(box).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "Emma Williams" }).id,
      );
      await user.keyboard("{Enter}");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("r3");
    });

    it("moves the highlight with ArrowUp, wrapping round", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowUp}{Enter}");

      expect(onChange).toHaveBeenCalledWith("r3");
    });

    it("selects the first match for a typed query on Enter", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.type(box, "emma{Enter}");

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("r3");
    });

    it("drops the highlight when the query changes", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowDown}{ArrowDown}");
      await user.type(box, "s");
      await user.keyboard("{Enter}");

      // "s" matches both; Enter takes the first match, not the row highlighted before typing.
      expect(onChange).toHaveBeenCalledWith("r1");
    });

    describe("highlight follows the option, not its position", () => {
      const THREE = [
        { value: "a", label: "Ann Adams" },
        { value: "b", label: "Ben Brown" },
        { value: "c", label: "Cara Clarke" },
      ];

      function renderThree(onChange = vi.fn()) {
        const props = {
          id: "rider",
          label: "Rider",
          value: null,
          onChange,
        };
        const view = render(
          <SearchableSelectField {...props} options={THREE} />,
        );
        const update = (options: typeof THREE) =>
          view.rerender(<SearchableSelectField {...props} options={options} />);
        return {
          onChange,
          update,
          box: screen.getByRole("combobox", { name: "Rider" }),
        };
      }

      it("leaves no dangling aria-activedescendant, and Enter does nothing, when the list shrinks under the last option", async () => {
        const user = userEvent.setup();
        const { onChange, update, box } = renderThree();

        await user.click(box);
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
        expect(box).toHaveAttribute(
          "aria-activedescendant",
          screen.getByRole("option", { name: "Cara Clarke" }).id,
        );

        update(THREE.slice(0, 2));

        expect(box).not.toHaveAttribute("aria-activedescendant");
        for (const option of screen.getAllByRole("option")) {
          expect(option).toHaveAttribute("aria-selected", "false");
        }
        await user.keyboard("{Enter}");
        expect(onChange).not.toHaveBeenCalled();
      });

      it("does not bring a removed option's highlight back when it returns", async () => {
        const user = userEvent.setup();
        const { onChange, update, box } = renderThree();

        await user.click(box);
        await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
        update(THREE.slice(0, 2));
        update(THREE);

        expect(box).not.toHaveAttribute("aria-activedescendant");
        await user.keyboard("{Enter}");
        expect(onChange).not.toHaveBeenCalled();
      });

      it("keeps the highlight on the same option when an earlier one is removed", async () => {
        const user = userEvent.setup();
        const { onChange, update, box } = renderThree();

        await user.click(box);
        await user.keyboard("{ArrowDown}{ArrowDown}");
        update([THREE[1], THREE[2]]);

        const ben = screen.getByRole("option", { name: "Ben Brown" });
        expect(ben).toHaveAttribute("aria-selected", "true");
        expect(box).toHaveAttribute("aria-activedescendant", ben.id);
        await user.keyboard("{Enter}");

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith("b");
      });

      it("keeps the highlight on the same option when the list is reordered", async () => {
        const user = userEvent.setup();
        const { onChange, update, box } = renderThree();

        await user.click(box);
        await user.keyboard("{ArrowDown}{ArrowDown}");
        update([THREE[2], THREE[1], THREE[0]]);

        const ben = screen.getByRole("option", { name: "Ben Brown" });
        expect(ben).toHaveAttribute("aria-selected", "true");
        expect(box).toHaveAttribute("aria-activedescendant", ben.id);
        await user.keyboard("{Enter}");

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith("b");
      });
    });

    it("wraps ArrowDown from the last option to the first", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");

      expect(onChange).toHaveBeenCalledWith("r1");
    });

    it("wraps ArrowUp from the first option to the last", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");

      expect(onChange).toHaveBeenCalledWith("r3");
    });

    it("forgets the highlight when the field loses focus", async () => {
      const user = userEvent.setup();
      const { onChange, box } = renderEmpty();

      await user.click(box);
      await user.keyboard("{ArrowDown}");
      await user.tab();
      await waitFor(() =>
        expect(
          screen.queryByRole("option", { name: "Sarah Jones" }),
        ).not.toBeInTheDocument(),
      );

      await user.click(box);
      for (const option of screen.getAllByRole("option")) {
        expect(option).toHaveAttribute("aria-selected", "false");
      }
      await user.keyboard("{Enter}");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores Enter and the arrows while an IME is composing", () => {
      const onChange = vi.fn();
      render(
        <SearchableSelectField
          id="rider"
          label="Rider"
          value={null}
          onChange={onChange}
          options={OPTIONS}
        />,
      );
      const box = screen.getByRole("combobox", { name: "Rider" });
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "emma" } });

      fireEvent.keyDown(box, { key: "Enter", isComposing: true });
      fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });
      fireEvent.keyDown(box, { key: "ArrowDown", isComposing: true });
      fireEvent.keyDown(box, { key: "ArrowDown", keyCode: 229 });
      fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });

      expect(onChange).not.toHaveBeenCalled();
      expect(box).not.toHaveAttribute("aria-activedescendant");

      // The same typed query, outside composition, still selects.
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onChange).toHaveBeenCalledWith("r3");
    });

    it("does not submit an enclosing form on Enter", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn((event: React.FormEvent) =>
        event.preventDefault(),
      );
      const onChange = vi.fn();
      render(
        <form onSubmit={onSubmit}>
          <SearchableSelectField
            id="rider"
            label="Rider"
            value={null}
            onChange={onChange}
            options={OPTIONS}
          />
          <button type="submit">Save</button>
        </form>,
      );
      const box = screen.getByRole("combobox", { name: "Rider" });

      await user.click(box);
      await user.keyboard("{Enter}");
      await user.keyboard("{ArrowDown}{Enter}");
      await user.type(box, "emma{Enter}");

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("scrolls the highlighted option into view", async () => {
      const user = userEvent.setup();
      const scrollIntoView = vi.fn();
      const original = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
      try {
        const { box } = renderEmpty();

        await user.click(box);
        scrollIntoView.mockClear();
        await user.keyboard("{ArrowDown}{ArrowDown}");

        const last = scrollIntoView.mock.calls.at(-1);
        expect(last?.[0]).toEqual({ block: "nearest" });
        expect(scrollIntoView.mock.contexts.at(-1)).toBe(
          screen.getByRole("option", { name: "Emma Williams" }),
        );
      } finally {
        HTMLElement.prototype.scrollIntoView = original;
      }
    });

    it("does not break where scrollIntoView does not exist", async () => {
      const user = userEvent.setup();
      const original = HTMLElement.prototype.scrollIntoView;
      // @ts-expect-error simulate an environment without scrollIntoView
      HTMLElement.prototype.scrollIntoView = undefined;
      try {
        const { onChange, box } = renderEmpty();

        await user.click(box);
        await user.keyboard("{ArrowDown}{Enter}");

        expect(onChange).toHaveBeenCalledWith("r1");
      } finally {
        HTMLElement.prototype.scrollIntoView = original;
      }
    });
  });
});
