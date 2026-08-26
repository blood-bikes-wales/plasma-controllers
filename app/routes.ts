import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  layout("routes/protected-layout.tsx", [
    layout("routes/dashboard-layout.tsx", [
      route("dashboard", "routes/dashboard.tsx"),
      route("shifts", "routes/shifts.tsx"),
      route("jobs", "routes/jobs.tsx", [
        route("new", "routes/jobs-new.tsx", [
          route("assign", "routes/jobs-new-assign.tsx"),
        ]),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
