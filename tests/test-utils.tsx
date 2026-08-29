import { type RenderOptions, render } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router";
import { afterEach, vi } from "vitest";
import { clearActiveRole } from "~/lib/active-role";
import { AuthProvider, type AuthUser } from "~/lib/auth";
import { clearAuthToken, setAuthToken } from "~/lib/auth-token";

import { mockAuthUser, stubAuthenticatedFetch } from "./auth-fixtures";

afterEach(() => {
  clearAuthToken();
  clearActiveRole();
  vi.unstubAllGlobals();
});

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

export function renderWithRouter(
  routes: RouteObject[],
  initialEntry = "/",
  options?: Omit<RenderOptions, "wrapper"> & {
    authenticated?: boolean;
    user?: AuthUser;
  },
) {
  const {
    authenticated = false,
    user = mockAuthUser,
    ...renderOptions
  } = options ?? {};

  if (authenticated) {
    setAuthToken("test-google-id-token");
    vi.stubGlobal("fetch", stubAuthenticatedFetch(user));
  }

  if (!authenticated) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ message: "Unauthenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
  }

  const router = createMemoryRouter(withAuthProvider(routes), {
    initialEntries: [initialEntry],
  });

  return {
    router,
    ...render(<RouterProvider router={router} />, renderOptions),
  };
}
