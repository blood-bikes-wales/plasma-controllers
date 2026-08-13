import type { RouteObject } from "react-router";

import Index from "~/routes/_index";
import DashboardPage from "~/routes/dashboard";
import DashboardLayout from "~/routes/dashboard-layout";
import JobsPage from "~/routes/jobs";
import JobsNewRoute from "~/routes/jobs-new";
import JobsNewAssignRoute from "~/routes/jobs-new-assign";
import LoginPage from "~/routes/login";
import ProtectedLayout from "~/routes/protected-layout";

export const appRoutes: RouteObject[] = [
  { index: true, Component: Index },
  { path: "login", Component: LoginPage },
  {
    Component: ProtectedLayout,
    children: [
      {
        Component: DashboardLayout,
        children: [
          { path: "dashboard", Component: DashboardPage },
          {
            path: "jobs",
            Component: JobsPage,
            children: [
              {
                path: "new",
                Component: JobsNewRoute,
                children: [{ path: "assign", Component: JobsNewAssignRoute }],
              },
            ],
          },
        ],
      },
    ],
  },
];
