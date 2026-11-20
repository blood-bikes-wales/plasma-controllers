import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "~/lib/api-client";
import {
  createJobContent,
  fetchJobContents,
  jobContentErrorMessage,
  selectableJobContents,
  sortJobContents,
  updateJobContent,
} from "~/lib/job-contents";

vi.mock("~/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/api-client")>()),
  apiFetch: vi.fn(),
}));

describe("job contents API", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetches the entries from /job-contents", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: [{ id: "c1", name: "Blood samples" }],
    });

    await expect(fetchJobContents()).resolves.toEqual([
      { id: "c1", name: "Blood samples" },
    ]);
    expect(apiFetch).toHaveBeenCalledWith("/job-contents");
  });

  it("creates an entry with POST", async () => {
    const created = { id: "c1", name: "Plasma", active: true, sortOrder: 1 };
    vi.mocked(apiFetch).mockResolvedValue(created);

    await expect(createJobContent({ name: "Plasma" })).resolves.toEqual(
      created,
    );
    expect(apiFetch).toHaveBeenCalledWith("/job-contents", {
      method: "POST",
      body: JSON.stringify({ name: "Plasma" }),
    });
  });

  it("renames or deactivates an entry with PATCH", async () => {
    vi.mocked(apiFetch).mockResolvedValue({});

    await updateJobContent("c1", { active: false });

    expect(apiFetch).toHaveBeenCalledWith("/job-contents/c1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
  });
});

describe("sortJobContents", () => {
  it("orders by sort order, then name ignoring case, without mutating", () => {
    const entries = [
      { id: "3", name: "plasma", sortOrder: 2 },
      { id: "1", name: "Milk", sortOrder: 2 },
      { id: "2", name: "Blood samples", sortOrder: 1 },
    ];

    expect(sortJobContents(entries).map((entry) => entry.id)).toEqual([
      "2",
      "1",
      "3",
    ]);
    expect(entries[0].id).toBe("3");
  });
});

describe("selectableJobContents", () => {
  it("drops retired entries and keeps picker entries without an active flag", () => {
    expect(
      selectableJobContents([
        { id: "1", name: "Blood samples", active: true },
        { id: "2", name: "Retired thing", active: false },
        { id: "3", name: "Milk" },
      ]).map((entry) => entry.name),
    ).toEqual(["Blood samples", "Milk"]);
  });
});

describe("jobContentErrorMessage", () => {
  it("prefers the API message, then the error message, then the fallback", () => {
    expect(
      jobContentErrorMessage(new ApiError(422, "Already exists."), "Fallback"),
    ).toBe("Already exists.");
    expect(jobContentErrorMessage(new Error("Network down"), "Fallback")).toBe(
      "Network down",
    );
    expect(jobContentErrorMessage("nope", "Fallback")).toBe("Fallback");
  });
});
