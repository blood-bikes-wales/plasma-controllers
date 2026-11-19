import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearActiveRole, setActiveRole } from "~/lib/active-role";
import { AuthProvider } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";
import { Role } from "~/lib/roles";
import { mockAuthUser } from "../../tests/auth-fixtures";
import { mockActiveJobs, stubJobsFetch } from "../../tests/job-fixtures";
import { appRoutes } from "../../tests/routes-config";

function withAuthProvider(routes: RouteObject[]): RouteObject[] {
  return [
    {
      element: (
        <AuthProvider>
          <Outlet />
        </AuthProvider>
      ),
      children: routes,
    },
  ];
}

function renderJobDetail({
  jobId = mockActiveJobs[0].id,
  roles = [Role.Controller],
}: {
  jobId?: string;
  roles?: Role[];
} = {}) {
  const user = { ...mockAuthUser, roles };
  setAuthToken("test-google-id-token");
  setActiveRole(roles[0]);
  vi.stubGlobal("fetch", stubJobsFetch(user));

  const router = createMemoryRouter(withAuthProvider(appRoutes), {
    initialEntries: [`/jobs/${jobId}`],
  });

  render(<RouterProvider router={router} />);
}

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

describe("Job detail lifecycle", () => {
  it("shows allocate controls for a new job when the user can manage jobs", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Record collection" }),
    ).not.toBeInTheDocument();
  });

  it("hides lifecycle controls for riders", async () => {
    renderJobDetail({ roles: [Role.Rider] });

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Allocate rider" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cancel job" }),
    ).not.toBeInTheDocument();
  });

  it("shows relay conversion controls for a new job", async () => {
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "JB-1042" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Convert to relay" }),
    ).toBeInTheDocument();
  });

  it("allocates a rider and advances the job status", async () => {
    const user = userEvent.setup();
    renderJobDetail();

    expect(
      await screen.findByRole("heading", { name: "Allocate rider" }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Active shift rider"));
    await user.click(
      await screen.findByRole("option", { name: /Alex Morgan/ }),
    );

    await user.click(screen.getByRole("button", { name: "Allocate rider" }));

    await waitFor(() => {
      expect(screen.getByText("Allocated")).toBeInTheDocument();
    });
    expect(screen.getByText(/Allocated rider:/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Allocate rider" }),
    ).not.toBeInTheDocument();
  });
});

describe("Record collection job number", () => {
  const allocatedJobId = mockActiveJobs[1].id;

  it("labels the field Job number and not Receipt number", async () => {
    renderJobDetail({ jobId: allocatedJobId });

    expect(
      await screen.findByRole("heading", { name: "Record collection" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Job number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Receipt number")).not.toBeInTheDocument();
  });

  it("requires a job number", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: allocatedJobId });

    await user.click(
      await screen.findByRole("button", { name: "Record collection" }),
    );

    expect(await screen.findByText("Enter a job number")).toBeInTheDocument();
    expect(screen.queryByText(/receipt number/i)).not.toBeInTheDocument();
  });

  it("shows the job number on the job detail after collection", async () => {
    const user = userEvent.setup();
    renderJobDetail({ jobId: allocatedJobId });

    await user.click(await screen.findByLabelText("Contents confirmed"));
    await user.click(await screen.findByRole("option", { name: "Yes" }));
    await user.click(screen.getByLabelText("Suitably sealed"));
    await user.click(await screen.findByRole("option", { name: "No" }));
    await user.type(screen.getByLabelText("Job number"), "JN-2042");
    await user.click(screen.getByRole("button", { name: "Record collection" }));

    expect(await screen.findByText("Collected · job JN-2042")).toBeVisible();
    expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
  });
});
