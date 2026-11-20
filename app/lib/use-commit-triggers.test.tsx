import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useCommitOnComplete } from "./use-commit-on-complete";
import { useCommitTriggers, type Validation } from "./use-commit-triggers";

type Values = {
  name: string;
  note: string;
  agree: boolean;
  extra: boolean;
};
type Payload = { name: string; agree: true };

function validate(values: Values): Validation<Payload> {
  const errors: Record<string, string> = {};
  if (values.name.trim() === "") {
    errors.name = "Enter a name";
  }
  if (!values.agree) {
    errors.agree = "Tick the box";
  }
  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { payload: { name: values.name.trim(), agree: true } };
}

function Harness({
  commit,
  initial = { name: "", note: "", agree: false, extra: false },
}: {
  commit: (payload: Payload) => Promise<unknown>;
  initial?: Values;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const committer = useCommitOnComplete<Payload>({
    commit,
    errorMessage: () => "It failed.",
  });
  const triggers = useCommitTriggers({
    values,
    validate,
    committer,
    onValidation: setErrors,
  });

  return (
    <div>
      <button type="button">Outside before</button>
      <form
        aria-label="Test form"
        onSubmit={(event) => event.preventDefault()}
        {...triggers.formProps}
      >
        <fieldset disabled={committer.isCommitting}>
          <label>
            Name
            <input
              value={values.name}
              onChange={(event) =>
                setValues({ ...values, name: event.target.value })
              }
            />
          </label>
          <label>
            Note
            <textarea
              value={values.note}
              onChange={(event) =>
                setValues({ ...values, note: event.target.value })
              }
            />
          </label>
          <label>
            Agree
            <input
              type="checkbox"
              checked={values.agree}
              onChange={(event) => {
                const next = { ...values, agree: event.target.checked };
                setValues(next);
                triggers.commitAfterGesture(next);
              }}
            />
          </label>
          <label>
            Extra
            <input
              type="checkbox"
              checked={values.extra}
              onChange={(event) => {
                const next = { ...values, extra: event.target.checked };
                setValues(next);
                triggers.commitAfterGesture(next);
              }}
            />
          </label>
          <button type="button">Help</button>
        </fieldset>
        <p role="status">{committer.isCommitting ? "Saving" : null}</p>
        {committer.error ? <p role="alert">{committer.error}</p> : null}
        <output>{JSON.stringify(errors)}</output>
      </form>
      <button type="button">Outside after</button>
    </div>
  );
}

function setup(
  props: Partial<React.ComponentProps<typeof Harness>> = {},
  strict = false,
) {
  const commit = vi.fn(async (_payload: Payload) => {});
  const element = <Harness commit={commit} {...props} />;
  render(strict ? <StrictMode>{element}</StrictMode> : element);
  return { commit, user: userEvent.setup() };
}

const complete: Values = {
  name: "Ann",
  note: "",
  agree: true,
  extra: false,
};

describe("useCommitTriggers", () => {
  describe("never on its own", () => {
    it.each([
      false,
      true,
    ])("does nothing on mount, even for a complete form (strict: %s)", (strict) => {
      const { commit } = setup({ initial: complete }, strict);

      expect(commit).not.toHaveBeenCalled();
    });

    it("does nothing per keystroke", async () => {
      const { commit, user } = setup({
        initial: { ...complete, name: "" },
      });

      await user.type(screen.getByLabelText("Name"), "Ann");

      expect(commit).not.toHaveBeenCalled();
    });

    it("does nothing when tabbing through an unchanged complete form and out", async () => {
      const { commit, user } = setup({ initial: complete });

      screen.getByRole("button", { name: "Outside before" }).focus();
      for (let step = 0; step < 7; step += 1) {
        await user.tab();
      }

      expect(commit).not.toHaveBeenCalled();
    });
  });

  describe("Enter", () => {
    it("commits a complete form once, with the payload", async () => {
      const { commit, user } = setup({ initial: complete });

      await user.click(screen.getByLabelText("Name"));
      await user.keyboard("{Enter}");

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ name: "Ann", agree: true });
    });

    it("commits from the checkbox too", async () => {
      const { commit, user } = setup({ initial: complete });

      screen.getByLabelText("Agree").focus();
      await user.keyboard("{Enter}");

      expect(commit).toHaveBeenCalledTimes(1);
    });

    it("on an incomplete form posts nothing and reports every error", async () => {
      const { commit, user } = setup();

      await user.click(screen.getByLabelText("Name"));
      await user.keyboard("{Enter}");

      expect(commit).not.toHaveBeenCalled();
      expect(
        JSON.parse(screen.getByText(/Enter a name/).textContent ?? ""),
      ).toEqual({ name: "Enter a name", agree: "Tick the box" });
    });

    it("clears the reported errors when a valid attempt starts", async () => {
      const { user } = setup({ initial: { ...complete, name: "" } });

      await user.click(screen.getByLabelText("Name"));
      await user.keyboard("{Enter}");
      expect(screen.getByText(/Enter a name/)).toBeInTheDocument();

      await user.type(screen.getByLabelText("Name"), "Ann{Enter}");
      expect(screen.getByText("{}")).toBeInTheDocument();
    });

    it("keeps its normal meaning in a textarea and on a button", async () => {
      const { commit, user } = setup({ initial: complete });

      await user.type(screen.getByLabelText("Note"), "line one{Enter}two");
      expect(screen.getByLabelText("Note")).toHaveValue("line one\ntwo");
      screen.getByRole("button", { name: "Help" }).focus();
      await user.keyboard("{Enter}");

      expect(commit).not.toHaveBeenCalled();
    });

    it("ignores a held key, an IME composition and a key the field already handled", () => {
      const { commit } = setup({ initial: complete });
      const name = screen.getByLabelText("Name");

      fireEvent.keyDown(name, { key: "Enter", repeat: true });
      fireEvent.keyDown(name, { key: "Enter", isComposing: true });
      fireEvent.keyDown(name, { key: "Enter", keyCode: 229 });
      name.addEventListener("keydown", (event) => event.preventDefault());
      fireEvent.keyDown(name, { key: "Enter" });
      fireEvent.keyDown(name, { key: "a" });

      expect(commit).not.toHaveBeenCalled();
    });

    it("ignores a second Enter while the first is still running", () => {
      const { commit } = setup({ initial: complete });
      const name = screen.getByLabelText("Name");

      act(() => {
        fireEvent.keyDown(name, { key: "Enter" });
        fireEvent.keyDown(name, { key: "Enter" });
      });

      expect(commit).toHaveBeenCalledTimes(1);
    });
  });

  describe("leaving the form", () => {
    it("commits a complete form that was edited when focus goes outside", async () => {
      const { commit, user } = setup({
        initial: { ...complete, name: "An" },
      });

      await user.type(screen.getByLabelText("Name"), "n");
      expect(commit).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Outside after" }));

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ name: "Ann", agree: true });
    });

    it("commits when an edit to an earlier field is followed by tabbing out of a later, untouched one", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "An" } });

      await user.type(screen.getByLabelText("Name"), "n");
      await user.tab(); // Note
      await user.tab(); // Agree
      await user.tab(); // Extra
      await user.tab(); // Help
      expect(commit).not.toHaveBeenCalled();
      await user.tab(); // Outside after

      expect(commit).toHaveBeenCalledTimes(1);
    });

    it("does not commit when focus moves to another field inside the form", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "An" } });

      await user.type(screen.getByLabelText("Name"), "n");
      await user.click(screen.getByLabelText("Note"));
      await user.click(screen.getByRole("button", { name: "Help" }));

      expect(commit).not.toHaveBeenCalled();
    });

    it("does not commit when the values are back to what they were", async () => {
      const { commit, user } = setup({ initial: complete });

      const name = screen.getByLabelText("Name");
      await user.type(name, "x");
      await user.type(name, "{Backspace}");
      await user.click(screen.getByRole("button", { name: "Outside after" }));

      expect(commit).not.toHaveBeenCalled();
    });

    it("keeps an edit pending while the form is incomplete and commits once it is complete", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "" } });

      await user.type(screen.getByLabelText("Name"), "A");
      await user.clear(screen.getByLabelText("Name"));
      await user.type(screen.getByLabelText("Name"), "Bo");
      await user.click(screen.getByRole("button", { name: "Outside after" }));
      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ name: "Bo", agree: true });
    });

    it("reports the errors when an edited incomplete form is left", async () => {
      const { commit, user } = setup();

      await user.type(screen.getByLabelText("Name"), "Ann");
      await user.click(screen.getByRole("button", { name: "Outside after" }));

      expect(commit).not.toHaveBeenCalled();
      expect(screen.getByText(/Tick the box/)).toBeInTheDocument();
    });

    it("does not commit when the window loses focus and the field stays active", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "An" } });

      const name = screen.getByLabelText("Name");
      await user.type(name, "n");
      fireEvent.blur(name);

      expect(commit).not.toHaveBeenCalled();
    });

    it("treats a press inside the form as staying in it", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "An" } });

      const name = screen.getByLabelText("Name");
      await user.type(name, "n");
      fireEvent.mouseDown(screen.getByLabelText("Agree"));
      act(() => name.blur());
      fireEvent.mouseUp(screen.getByLabelText("Agree"));

      expect(commit).not.toHaveBeenCalled();
    });

    it("forgets a press that never reached a blur, so the next real leave commits", async () => {
      const { commit, user } = setup({ initial: { ...complete, name: "An" } });

      const name = screen.getByLabelText("Name");
      await user.type(name, "n");
      fireEvent.mouseDown(screen.getByLabelText("Note"));
      // The press ended outside the form (no mouseup here), then the user
      // clicked back into a field and carried on from the keyboard.
      await user.click(name);
      await user.click(screen.getByRole("button", { name: "Outside after" }));

      expect(commit).toHaveBeenCalledTimes(1);
    });
  });

  describe("a single-gesture control", () => {
    it("commits when the gesture completes the form", async () => {
      const { commit, user } = setup({
        initial: { ...complete, agree: false },
      });

      await user.click(screen.getByLabelText("Agree"));

      expect(commit).toHaveBeenCalledTimes(1);
      expect(commit).toHaveBeenCalledWith({ name: "Ann", agree: true });
    });

    it("does not commit when the form is still incomplete after it", async () => {
      const { commit, user } = setup();

      await user.click(screen.getByLabelText("Agree"));

      expect(commit).not.toHaveBeenCalled();
      expect(screen.getByText("{}")).toBeInTheDocument();
    });

    it("does not commit when the form was already complete before it", async () => {
      const { commit, user } = setup({ initial: complete });

      await user.click(screen.getByLabelText("Extra"));
      expect(screen.getByLabelText("Extra")).toBeChecked();
      expect(commit).not.toHaveBeenCalled();

      // It counts as an edit, so leaving the form commits.
      await user.click(screen.getByRole("button", { name: "Outside after" }));
      expect(commit).toHaveBeenCalledTimes(1);
    });

    it("does not commit when the gesture makes a complete form incomplete", async () => {
      const { commit, user } = setup({ initial: complete });

      await user.click(screen.getByLabelText("Agree"));

      expect(screen.getByLabelText("Agree")).not.toBeChecked();
      expect(commit).not.toHaveBeenCalled();
    });

    it("commits once when the gesture is reported twice", () => {
      const { commit } = setup({
        initial: { ...complete, agree: false },
      });
      const agree = screen.getByLabelText("Agree");

      act(() => {
        fireEvent.click(agree);
        fireEvent.click(agree);
      });

      expect(commit).toHaveBeenCalledTimes(1);
    });
  });

  describe("after a failure", () => {
    it("keeps the values, never retries by itself, and retries on the next Enter", async () => {
      const commit = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockImplementationOnce(async () => {
          // A browser drops focus from a field that gets disabled.
          (document.activeElement as HTMLElement | null)?.blur();
          throw new Error("no");
        })
        .mockResolvedValue(undefined);
      render(<Harness commit={commit} initial={complete} />);
      const user = userEvent.setup();
      const name = screen.getByLabelText("Name");

      await user.click(name);
      await user.keyboard("{Enter}");
      expect(await screen.findByRole("alert")).toHaveTextContent("It failed.");
      expect(commit).toHaveBeenCalledTimes(1);
      expect(name).toHaveValue("Ann");
      expect(name).toBeEnabled();
      // Focus is back where Enter was pressed.
      expect(name).toHaveFocus();

      // Leaving without an edit does not try again.
      await user.click(screen.getByRole("button", { name: "Outside after" }));
      expect(commit).toHaveBeenCalledTimes(1);

      await user.click(name);
      await user.keyboard("{Enter}");
      expect(commit).toHaveBeenCalledTimes(2);
    });

    it("does not pull focus back from where the user has moved to", async () => {
      let reject: (reason: unknown) => void = () => {};
      const commit = vi.fn(
        () =>
          new Promise<void>((_resolve, rej) => {
            reject = rej;
          }),
      );
      render(<Harness commit={commit} initial={complete} />);
      const user = userEvent.setup();

      await user.click(screen.getByLabelText("Name"));
      await user.keyboard("{Enter}");
      const elsewhere = screen.getByRole("button", { name: "Outside after" });
      elsewhere.focus();
      await act(async () => {
        reject(new Error("no"));
      });

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(elsewhere).toHaveFocus();
    });

    it("retries on leaving the form after an edit", async () => {
      const commit = vi
        .fn<(payload: Payload) => Promise<unknown>>()
        .mockRejectedValueOnce(new Error("no"))
        .mockResolvedValue(undefined);
      render(<Harness commit={commit} initial={complete} />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText("Name"), "{Enter}");
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      await user.type(screen.getByLabelText("Name"), "!");
      await user.click(screen.getByRole("button", { name: "Outside after" }));

      expect(commit).toHaveBeenCalledTimes(2);
      expect(commit).toHaveBeenLastCalledWith({ name: "Ann!", agree: true });
    });
  });
});
