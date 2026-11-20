import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { mockActiveShifts } from "../../tests/job-fixtures";
import { AllocateJobForm } from "./allocate-job-form";

function deferred() {
  let resolve: () => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderForm(
  props: Partial<React.ComponentProps<typeof AllocateJobForm>> = {},
) {
  const onSubmit = vi.fn(async (_shiftId: string) => {});
  const view = render(
    <AllocateJobForm
      shifts={mockActiveShifts}
      currentShiftId={null}
      currentRiderName={null}
      isSubmitting={false}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, ...view };
}

describe("AllocateJobForm", () => {
  it("has no submit button", () => {
    renderForm();

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Active shift rider")).toBeInTheDocument();
  });

  it("submits as soon as a rider is chosen, with that shift", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("shift-2");
  });

  it("submits the first match when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText("Active shift rider"), "sam{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("shift-2");
  });

  it("does not allocate on a stray Enter in the empty field", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.keyboard("{Enter}{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Active shift rider")).toHaveValue("");
  });

  it("allocates the highlighted rider on ArrowDown then Enter", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("shift-2");
  });

  it("posts once when the same choice is reported twice before a re-render", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onSubmit = vi.fn((_shiftId: string) => pending.promise);
    renderForm({ onSubmit });

    await user.click(screen.getByLabelText("Active shift rider"));
    const option = await screen.findByRole("option", { name: /Sam Taylor/ });

    act(() => {
      fireEvent.click(option);
      fireEvent.click(option);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
    });
  });

  it("posts once for two different choices in the same tick, keeping the first", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    const onSubmit = vi.fn((_shiftId: string) => pending.promise);
    renderForm({ onSubmit });

    await user.click(screen.getByLabelText("Active shift rider"));
    const alex = await screen.findByRole("option", { name: /Alex Morgan/ });
    const sam = screen.getByRole("option", { name: /Sam Taylor/ });

    act(() => {
      fireEvent.click(alex);
      fireEvent.click(sam);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("shift-1");
    expect(screen.getByLabelText("Active shift rider")).toHaveValue(
      "Alex Morgan · CF12 ABC",
    );

    await act(async () => {
      pending.resolve();
    });
  });

  it("disables the field and announces Allocating… while the request runs", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    renderForm({ onSubmit: () => pending.promise });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    expect(screen.getByRole("status")).toHaveTextContent("Allocating…");
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("keeps the choice and focus on the field after a success", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    expect(screen.getByLabelText("Active shift rider")).toHaveValue(
      "Sam Taylor · CF34 DEF",
    );
    expect(screen.getByLabelText("Active shift rider")).toHaveFocus();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error under the field, clears the choice, and keeps focus on a usable field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn<(shiftId: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Allocate only accepts a rider."))
      .mockResolvedValueOnce(undefined);
    renderForm({ onSubmit });

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Allocate only accepts a rider.",
    );
    const field = screen.getByLabelText("Active shift rider");
    expect(field).toHaveValue("");
    expect(field).toBeEnabled();
    expect(field).toHaveFocus();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    // The controller can choose again, and the old error goes.
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("shift-1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not take focus back from somewhere the user moved during the request", async () => {
    const user = userEvent.setup();
    const pending = deferred();
    render(
      <>
        <input aria-label="Elsewhere" />
        <AllocateJobForm
          shifts={mockActiveShifts}
          currentShiftId={null}
          currentRiderName={null}
          isSubmitting={false}
          onSubmit={() => pending.promise}
        />
      </>,
    );

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));
    await user.click(screen.getByLabelText("Elsewhere"));
    expect(screen.getByLabelText("Elsewhere")).toHaveFocus();

    await act(async () => {
      pending.resolve();
    });

    expect(screen.getByLabelText("Elsewhere")).toHaveFocus();
    expect(screen.getByLabelText("Active shift rider")).not.toHaveFocus();
  });

  it("keeps an always-present live region for the status line", () => {
    renderForm();

    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status.className).toContain("min-h-5");
    expect(status.className).not.toContain("hidden");
  });

  it("makes exactly one POST per choice under StrictMode", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async (_shiftId: string) => {});
    render(
      <StrictMode>
        <AllocateJobForm
          shifts={mockActiveShifts}
          currentShiftId={null}
          currentRiderName={null}
          isSubmitting={false}
          onSubmit={onSubmit}
        />
      </StrictMode>,
    );

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(await screen.findByRole("option", { name: /Sam Taylor/ }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("shift-2");

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("shift-1");
  });

  it("explains when no rider is on shift and offers nothing to choose", () => {
    const { onSubmit } = renderForm({ shifts: [] });

    expect(
      screen.getByText("No riders are currently on an active shift."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Active shift rider")).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is disabled while another action on the job runs", () => {
    renderForm({ isSubmitting: true });

    expect(screen.getByLabelText("Active shift rider")).toBeDisabled();
  });

  describe("on an Allocated job", () => {
    it("shows the current rider as the value and says who has the job", () => {
      renderForm({
        currentShiftId: "shift-1",
        currentRiderName: "Alex Morgan",
      });

      expect(screen.getByLabelText("New rider on shift")).toHaveValue(
        "Alex Morgan · CF12 ABC",
      );
      expect(screen.getByText(/Currently allocated to/).textContent).toContain(
        "Alex Morgan",
      );
    });

    it("posts the other rider when Change is used", async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm({
        currentShiftId: "shift-1",
        currentRiderName: "Alex Morgan",
      });

      await user.click(screen.getByRole("button", { name: "Change" }));
      await user.click(
        await screen.findByRole("option", { name: /Sam Taylor/ }),
      );

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith("shift-2");
    });

    it("posts nothing when the current rider is chosen again", async () => {
      const user = userEvent.setup();
      const { onSubmit } = renderForm({
        currentShiftId: "shift-1",
        currentRiderName: "Alex Morgan",
      });

      await user.click(screen.getByRole("button", { name: "Change" }));
      await user.click(
        await screen.findByRole("option", { name: /Alex Morgan/ }),
      );

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("New rider on shift")).toHaveValue(
        "Alex Morgan · CF12 ABC",
      );
    });

    it("puts the field back on the current rider when a change fails", async () => {
      const user = userEvent.setup();
      const onSubmit = vi
        .fn<(shiftId: string) => Promise<void>>()
        .mockRejectedValue(new Error("Nope"));
      renderForm({
        currentShiftId: "shift-1",
        currentRiderName: "Alex Morgan",
        onSubmit,
      });

      await user.click(screen.getByRole("button", { name: "Change" }));
      await user.click(
        await screen.findByRole("option", { name: /Sam Taylor/ }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent("Nope");
      expect(screen.getByLabelText("New rider on shift")).toHaveValue(
        "Alex Morgan · CF12 ABC",
      );
    });

    it("leaves the field empty when the current rider's shift has ended", () => {
      renderForm({
        currentShiftId: "shift-gone",
        currentRiderName: "Pat Jones",
        shifts: [mockActiveShifts[1]],
      });

      expect(screen.getByLabelText("New rider on shift")).toHaveValue("");
      expect(screen.getByText(/Currently allocated to/).textContent).toContain(
        "Pat Jones",
      );
    });

    it("follows the job when its rider changes", () => {
      const onSubmit = vi.fn(async (_shiftId: string) => {});
      const { rerender } = render(
        <AllocateJobForm
          shifts={mockActiveShifts}
          currentShiftId="shift-1"
          currentRiderName="Alex Morgan"
          isSubmitting={false}
          onSubmit={onSubmit}
        />,
      );

      rerender(
        <AllocateJobForm
          shifts={mockActiveShifts}
          currentShiftId="shift-2"
          currentRiderName="Sam Taylor"
          isSubmitting={false}
          onSubmit={onSubmit}
        />,
      );

      expect(screen.getByLabelText("New rider on shift")).toHaveValue(
        "Sam Taylor · CF34 DEF",
      );
    });
  });
});
