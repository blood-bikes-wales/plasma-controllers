import type { RouteObject } from "react-router";

import Index from "~/routes/_index";
import DashboardPage from "~/routes/dashboard";
import DashboardLayout from "~/routes/dashboard-layout";
import JobsPage from "~/routes/jobs";
import JobsDetailPage from "~/routes/jobs.$jobId";
import JobsNewRoute from "~/routes/jobs-new";
import JobsNewAssignRoute from "~/routes/jobs-new-assign";
import LoginPage from "~/routes/login";
import NoAccessPage from "~/routes/no-access";
import ProtectedLayout from "~/routes/protected-layout";
import SelectRolePage from "~/routes/select-role";
import ShiftsPage from "~/routes/shifts";

export const appRoutes: RouteObject[] = [
  { index: true, Component: Index },
  { path: "login", Component: LoginPage },
  {
    Component: ProtectedLayout,
    children: [
      { path: "no-access", Component: NoAccessPage },
      { path: "select-role", Component: SelectRolePage },
      {
        Component: DashboardLayout,
        children: [
          { path: "dashboard", Component: DashboardPage },
          { path: "shifts", Component: ShiftsPage },
          {
            path: "jobs",
            Component: JobsPage,
            children: [
              {
                path: "new",
                Component: JobsNewRoute,
                children: [{ path: "assign", Component: JobsNewAssignRoute }],
              },
              { path: ":jobId", Component: JobsDetailPage },
            ],
          },
        ],
      },
    ],
  },
];
