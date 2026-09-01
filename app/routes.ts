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
    route("no-access", "routes/no-access.tsx"),
    route("select-role", "routes/select-role.tsx"),
    layout("routes/dashboard-layout.tsx", [
      route("dashboard", "routes/dashboard.tsx"),
      route("shifts", "routes/shifts.tsx"),
      route("directory", "routes/directory.tsx"),
      route("bikes", "routes/bikes.tsx", [
        route("new", "routes/bikes-new.tsx"),
        route(":bikeId", "routes/bikes.$bikeId.tsx"),
      ]),
      route("jobs", "routes/jobs.tsx", [
        route("new", "routes/jobs-new.tsx", [
          route("assign", "routes/jobs-new-assign.tsx"),
        ]),
        route(":jobId", "routes/jobs.$jobId.tsx"),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
