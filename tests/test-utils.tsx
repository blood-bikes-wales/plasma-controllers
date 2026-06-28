import { type RenderOptions, render } from "@testing-library/react";
import {
  createMemoryRouter,
  type RouteObject,
  RouterProvider,
} from "react-router";

export function renderWithRouter(
  routes: RouteObject[],
  initialEntry = "/",
  options?: Omit<RenderOptions, "wrapper">,
) {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return {
    router,
    ...render(<RouterProvider router={router} />, options),
  };
}
