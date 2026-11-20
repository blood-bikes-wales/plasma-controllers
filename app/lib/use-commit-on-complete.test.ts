import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type CommitOnCompleteOptions,
  useCommitOnComplete,
} from "./use-commit-on-complete";

function deferred() {
  let resolve: () => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function message(caught: unknown) {
  return caught instanceof Error ? caught.message : "Something went wrong.";
}

function setup(overrides: Partial<CommitOnCompleteOptions<string>> = {}) {
  const commit = vi.fn(async (_payload: string) => {});
  const hook = renderHook(
    (options: CommitOnCompleteOptions<string>) => useCommitOnComplete(options),
    {
      initialProps: { commit, errorMessage: message, ...overrides },
    },
  );
  return { commit, ...hook };
}

describe("useCommitOnComplete", () => {
  it("does nothing while the payload is incomplete", () => {
    const { result, commit } = setup();

    let nullStarted = true;
    let undefinedStarted = true;
    act(() => {
      nullStarted = result.current.submit(null);
      undefinedStarted = result.current.submit(undefined);
    });

    expect(nullStarted).toBe(false);
    expect(undefinedStarted).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.isCommitting).toBe(false);
  });

  it("commits a complete payload once, flagging isCommitting while it runs", async () => {
    const pending = deferred();
    const commit = vi.fn((_payload: string) => pending.promise);
    const onSuccess = vi.fn();
    const { result } = setup({ commit, onSuccess });

    let started = false;
    act(() => {
      started = result.current.submit("shift-1");
    });

    expect(started).toBe(true);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("shift-1");
    expect(result.current.isCommitting).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve();
    });

    expect(result.current.isCommitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith("shift-1");
  });

  it("makes one commit when the same choice is reported twice in one tick", async () => {
    const pending = deferred();
    const commit = vi.fn((_payload: string) => pending.promise);
    const { result } = setup({ commit });

    const started: boolean[] = [];
    act(() => {
      started.push(result.current.submit("shift-1"));
      started.push(result.current.submit("shift-1"));
    });

    expect(started).toEqual([true, false]);
    expect(commit).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
    });
  });

  it("ignores a different choice made while one is in flight", async () => {
    const pending = deferred();
    const commit = vi.fn((_payload: string) => pending.promise);
    const { result } = setup({ commit });

    act(() => {
      result.current.submit("shift-1");
    });

    let started = true;
    act(() => {
      started = result.current.submit("shift-2");
    });

    expect(started).toBe(false);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("shift-1");

    await act(async () => {
      pending.resolve();
    });
  });

  it("accepts the next choice once the previous commit has finished", async () => {
    const { result, commit } = setup();

    await act(async () => {
      result.current.submit("shift-1");
    });
    await act(async () => {
      result.current.submit("shift-2");
    });

    expect(commit.mock.calls.map(([payload]) => payload)).toEqual([
      "shift-1",
      "shift-2",
    ]);
  });

  it("exposes the error and calls onFailure so the form can reset, then allows a retry", async () => {
    const onFailure = vi.fn();
    const onSuccess = vi.fn();
    const commit = vi
      .fn<(payload: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("The selected shift is invalid."))
      .mockResolvedValueOnce(undefined);
    const { result } = setup({ commit, onFailure, onSuccess });

    await act(async () => {
      result.current.submit("shift-1");
    });

    expect(result.current.error).toBe("The selected shift is invalid.");
    expect(result.current.isCommitting).toBe(false);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(
      "The selected shift is invalid.",
      "shift-1",
      expect.any(Error),
    );
    expect(onSuccess).not.toHaveBeenCalled();

    // The next attempt clears the old error as soon as it starts.
    const pending = deferred();
    commit.mockReturnValueOnce(pending.promise);
    act(() => {
      result.current.submit("shift-2");
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isCommitting).toBe(true);

    await act(async () => {
      pending.resolve();
    });
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith("shift-2");
  });

  it("describes a failure with errorMessage, whatever was thrown", async () => {
    const commit = vi.fn(async (_payload: string) => {
      throw "not an Error";
    });
    const { result } = setup({ commit });

    await act(async () => {
      result.current.submit("shift-1");
    });

    expect(result.current.error).toBe("Something went wrong.");
  });

  it("hands the original thrown value to onFailure as the third argument", async () => {
    const thrown = Object.assign(new Error("Unprocessable"), {
      body: { errors: { shiftId: ["The selected shift is invalid."] } },
    });
    const onFailure = vi.fn();
    const { result } = setup({
      commit: vi.fn(async (_payload: string) => {
        throw thrown;
      }),
      onFailure,
    });

    await act(async () => {
      result.current.submit("shift-1");
    });

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][2]).toBe(thrown);

    const nonError = vi.fn();
    const second = setup({
      commit: vi.fn(async (_payload: string) => {
        throw "plain string";
      }),
      onFailure: nonError,
    });
    await act(async () => {
      second.result.current.submit("shift-2");
    });
    expect(nonError).toHaveBeenCalledWith(
      "Something went wrong.",
      "shift-2",
      "plain string",
    );
  });

  it("clears the error on request", async () => {
    const commit = vi.fn(async (_payload: string) => {
      throw new Error("Nope");
    });
    const { result } = setup({ commit });

    await act(async () => {
      result.current.submit("shift-1");
    });
    expect(result.current.error).toBe("Nope");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("uses the latest callbacks without being re-created", async () => {
    const first = vi.fn(async (_payload: string) => {});
    const second = vi.fn(async (_payload: string) => {});
    const { result, rerender } = setup({ commit: first });
    const submit = result.current.submit;

    rerender({ commit: second, errorMessage: message });
    expect(result.current.submit).toBe(submit);

    await act(async () => {
      result.current.submit("shift-1");
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("shift-1");
  });

  it("does not cancel on unmount: the commit finishes and the callbacks still run", async () => {
    const pending = deferred();
    const onSuccess = vi.fn();
    const { result, unmount } = setup({
      commit: () => pending.promise,
      onSuccess,
    });

    act(() => {
      result.current.submit("shift-1");
    });
    unmount();
    pending.resolve();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("shift-1"));
  });

  it("still runs onFailure after unmount", async () => {
    const pending = deferred();
    const onFailure = vi.fn();
    const { result, unmount } = setup({
      commit: () => pending.promise,
      onFailure,
    });

    act(() => {
      result.current.submit("shift-1");
    });
    unmount();
    pending.reject(new Error("Nope"));

    await waitFor(() =>
      expect(onFailure).toHaveBeenCalledWith(
        "Nope",
        "shift-1",
        expect.any(Error),
      ),
    );
  });

  describe("when a callback throws", () => {
    function unhandledRejections() {
      const seen: unknown[] = [];
      const listener = (reason: unknown) => {
        seen.push(reason);
      };
      process.on("unhandledRejection", listener);
      return {
        seen,
        stop: () => process.off("unhandledRejection", listener),
      };
    }

    it("releases the guard and shows the fallback when errorMessage throws", async () => {
      const rejections = unhandledRejections();
      const commit = vi
        .fn<(payload: string) => Promise<unknown>>()
        .mockRejectedValueOnce(new Error("Nope"))
        .mockResolvedValueOnce(undefined);
      const onFailure = vi.fn();
      const { result } = setup({
        commit,
        onFailure,
        errorMessage: () => {
          throw new Error("errorMessage broke");
        },
      });

      await act(async () => {
        result.current.submit("shift-1");
      });

      expect(result.current.isCommitting).toBe(false);
      expect(result.current.error).toBe("Something went wrong.");
      expect(onFailure).toHaveBeenCalledWith(
        "Something went wrong.",
        "shift-1",
        expect.any(Error),
      );

      // Not stuck: the next choice goes through.
      let started = false;
      await act(async () => {
        started = result.current.submit("shift-2");
      });
      expect(started).toBe(true);
      expect(commit).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setTimeout(resolve, 0));
      rejections.stop();
      expect(rejections.seen).toEqual([]);
    });

    it("releases the guard and logs when onSuccess throws", async () => {
      const rejections = unhandledRejections();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result, commit } = setup({
        onSuccess: () => {
          throw new Error("onSuccess broke");
        },
      });

      await act(async () => {
        result.current.submit("shift-1");
      });

      expect(result.current.isCommitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(errorSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        result.current.submit("shift-2");
      });
      expect(commit).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setTimeout(resolve, 0));
      rejections.stop();
      expect(rejections.seen).toEqual([]);
      errorSpy.mockRestore();
    });

    it("releases the guard and logs when onFailure throws, keeping the error", async () => {
      const rejections = unhandledRejections();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const commit = vi
        .fn<(payload: string) => Promise<unknown>>()
        .mockRejectedValue(new Error("Nope"));
      const { result } = setup({
        commit,
        onFailure: () => {
          throw new Error("onFailure broke");
        },
      });

      await act(async () => {
        result.current.submit("shift-1");
      });

      expect(result.current.isCommitting).toBe(false);
      expect(result.current.error).toBe("Nope");
      expect(errorSpy).toHaveBeenCalledTimes(1);

      await act(async () => {
        result.current.submit("shift-2");
      });
      expect(commit).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setTimeout(resolve, 0));
      rejections.stop();
      expect(rejections.seen).toEqual([]);
      errorSpy.mockRestore();
    });

    it("releases the guard when commit throws before returning a promise", async () => {
      const commit = vi.fn((_payload: string): Promise<unknown> => {
        throw new Error("sync failure");
      });
      const { result } = setup({ commit });

      await act(async () => {
        result.current.submit("shift-1");
      });

      expect(result.current.error).toBe("sync failure");
      expect(result.current.isCommitting).toBe(false);
    });
  });

  it("commits exactly once per choice under StrictMode", async () => {
    const commit = vi.fn(async (_payload: string) => {});
    const { result } = renderHook(
      () => useCommitOnComplete<string>({ commit, errorMessage: message }),
      { wrapper: StrictMode },
    );

    await act(async () => {
      result.current.submit("shift-1");
    });
    await act(async () => {
      result.current.submit("shift-2");
    });

    expect(commit.mock.calls.map(([payload]) => payload)).toEqual([
      "shift-1",
      "shift-2",
    ]);
  });
});
