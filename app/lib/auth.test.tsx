import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "~/lib/auth";
import { clearAuthToken, getAuthToken, setAuthToken } from "~/lib/auth-token";

import {
  mockAuthUser,
  stubAuthenticatedFetch,
} from "../../tests/auth-fixtures";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

function AuthProbe() {
  const { user, status, loginWithCredential, logout } = useAuth();

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="name">{user?.name ?? ""}</span>
      <button
        type="button"
        onClick={() => void loginWithCredential("fresh-id-token")}
      >
        Login
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

function renderAuth() {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <AuthProvider>
            <AuthProbe />
          </AuthProvider>
        ),
      },
      { path: "/login", element: <div>Login page</div> },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("AuthProvider", () => {
  it("loads the profile from GET /me with the stored Bearer token", async () => {
    setAuthToken("stored-google-id-token");
    const fetchMock = stubAuthenticatedFetch(mockAuthUser);
    vi.stubGlobal("fetch", fetchMock);

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("name")).toHaveTextContent(mockAuthUser.name);

    const call = fetchMock.mock.calls[0];
    expect(String(call?.[0])).toContain("/me");
    expect(new Headers(call?.[1]?.headers).get("Authorization")).toBe(
      "Bearer stored-google-id-token",
    );
  });

  it("validates login via GET /me using the Google ID token as Bearer", async () => {
    const fetchMock = stubAuthenticatedFetch(mockAuthUser);
    vi.stubGlobal("fetch", fetchMock);

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    });

    screen.getByRole("button", { name: "Login" }).click();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(screen.getByTestId("name")).toHaveTextContent(mockAuthUser.name);
    expect(getAuthToken()).toBe("fresh-id-token");

    const meCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).includes("/me"),
    );
    expect(new Headers(meCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer fresh-id-token",
    );
  });

  it("clears the session when GET /me returns 401", async () => {
    setAuthToken("expired-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Unauthenticated." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    });
    expect(getAuthToken()).toBeNull();
  });

  it("keeps the session when GET /me fails with a transient error", async () => {
    setAuthToken("stored-google-id-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Server error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    renderAuth();

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    });
    expect(getAuthToken()).toBe("stored-google-id-token");
  });
});
