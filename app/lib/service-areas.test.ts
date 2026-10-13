import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "~/lib/api-client";
import { fetchServiceAreas, serviceAreaLabel } from "~/lib/service-areas";

vi.mock("~/lib/api-client", () => ({
  apiFetch: vi.fn(),
}));

describe("fetchServiceAreas", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("returns distinct service areas from the API", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      data: [
        { code: "E", name: "East" },
        { code: "NW", name: "North West" },
      ],
    });

    await expect(fetchServiceAreas()).resolves.toEqual([
      { code: "E", name: "East" },
      { code: "NW", name: "North West" },
    ]);
    expect(apiFetch).toHaveBeenCalledWith("/service-areas");
  });
});

describe("serviceAreaLabel", () => {
  it("resolves a known code to its full name", () => {
    expect(
      serviceAreaLabel("E", [{ code: "E", name: "East" }]),
    ).toBe("East");
  });

  it("falls back to the code when unknown", () => {
    expect(serviceAreaLabel("ZZ")).toBe("ZZ");
  });
});
