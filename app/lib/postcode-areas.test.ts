import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "~/lib/api-client";
import {
  createPostcodeArea,
  fetchPostcodeAreas,
  importPostcodeAreas,
  updatePostcodeArea,
} from "~/lib/postcode-areas";

vi.mock("~/lib/api-client", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe("postcode-areas client", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("fetches mappings with search and inactive flags", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: [] });

    await fetchPostcodeAreas({ q: "CF14", includeInactive: true });

    expect(apiFetch).toHaveBeenCalledWith(
      "/postcode-areas?q=CF14&includeInactive=1",
    );
  });

  it("creates and updates mappings", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      id: "1",
      outboundPostcode: "SA1",
      areaCode: "S",
      areaFullName: "Swansea",
      sortOrder: 1,
      active: true,
    });

    await createPostcodeArea({
      outboundPostcode: "SA1",
      areaCode: "S",
      areaFullName: "Swansea",
    });
    expect(apiFetch).toHaveBeenCalledWith("/postcode-areas", {
      method: "POST",
      body: JSON.stringify({
        outboundPostcode: "SA1",
        areaCode: "S",
        areaFullName: "Swansea",
      }),
    });

    await updatePostcodeArea("1", { active: false });
    expect(apiFetch).toHaveBeenCalledWith("/postcode-areas/1", {
      method: "PATCH",
      body: JSON.stringify({ active: false }),
    });
  });

  it("imports a CSV file as multipart form data", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ created: 1, updated: 2 });
    const file = new File(
      ["outboundPostcode,areaCode,areaFullName\nSA1,S,Swansea\n"],
      "mappings.csv",
      {
        type: "text/csv",
      },
    );

    await expect(importPostcodeAreas(file)).resolves.toEqual({
      created: 1,
      updated: 2,
    });

    const [, options] = vi.mocked(apiFetch).mock.calls[0] ?? [];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBeInstanceOf(FormData);
  });
});
