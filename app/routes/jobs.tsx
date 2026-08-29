import { Clock, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { AssignRiderDrawer } from "~/components/assign-rider-drawer";
import { NewJobDrawer } from "~/components/new-job-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/lib/auth";
import { canCreateJobs } from "~/lib/capabilities";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/jobs";

type JobStatus =
  | "New"
  | "Assigned"
  | "Accepted"
  | "Collected"
  | "Delivered"
  | "Escalated"
  | "Cancelled";

type FilterTab =
  | "All"
  | "New"
  | "Assigned"
  | "In Progress"
  | "Completed"
  | "Escalated";

type ActiveJob = {
  id: string;
  reference: string;
  urgent?: boolean;
  pickup: string;
  delivery: string;
  status: JobStatus;
  rider: string | null;
  updatedAt: string;
};

type CompletedJob = {
  id: string;
  reference: string;
  pickup: string;
  delivery: string;
  rider: string;
  completedAt: string;
  status: "Delivered" | "Cancelled";
};

const ACTIVE_AREA = "South Area";

const FILTER_TABS: FilterTab[] = [
  "All",
  "New",
  "Assigned",
  "In Progress",
  "Completed",
  "Escalated",
];

const MOCK_ACTIVE_JOBS: ActiveJob[] = [
  {
    id: "1",
    reference: "JB-1042",
    urgent: true,
    pickup: "Royal Glamorgan Hospital",
    delivery: "University Hospital of Wales",
    status: "New",
    rider: null,
    updatedAt: "2 min ago",
  },
  {
    id: "2",
    reference: "JB-1038",
    pickup: "Prince Charles Hospital",
    delivery: "Royal Gwent Hospital",
    status: "Assigned",
    rider: "Sarah Jones",
    updatedAt: "8 min ago",
  },
  {
    id: "3",
    reference: "JB-1035",
    pickup: "Nevill Hall Hospital",
    delivery: "Royal Glamorgan Hospital",
    status: "Accepted",
    rider: "Mike Davies",
    updatedAt: "14 min ago",
  },
  {
    id: "4",
    reference: "JB-1031",
    urgent: true,
    pickup: "Bronglais General Hospital",
    delivery: "Withybush General Hospital",
    status: "Collected",
    rider: "Emma Williams",
    updatedAt: "22 min ago",
  },
  {
    id: "5",
    reference: "JB-1027",
    pickup: "Morriston Hospital",
    delivery: "Singleton Hospital",
    status: "Escalated",
    rider: "Tom Evans",
    updatedAt: "35 min ago",
  },
  {
    id: "6",
    reference: "JB-1024",
    pickup: "Princess of Wales Hospital",
    delivery: "Royal Glamorgan Hospital",
    status: "Assigned",
    rider: "Lisa Morgan",
    updatedAt: "41 min ago",
  },
];

const MOCK_COMPLETED_JOBS: CompletedJob[] = [
  {
    id: "101",
    reference: "JB-1020",
    pickup: "Royal Glamorgan Hospital",
    delivery: "University Hospital of Wales",
    rider: "Sarah Jones",
    completedAt: "Today, 09:42",
    status: "Delivered",
  },
  {
    id: "102",
    reference: "JB-1016",
    pickup: "Prince Charles Hospital",
    delivery: "Royal Gwent Hospital",
    rider: "Mike Davies",
    completedAt: "Today, 08:15",
    status: "Delivered",
  },
  {
    id: "103",
    reference: "JB-1012",
    pickup: "Nevill Hall Hospital",
    delivery: "Royal Glamorgan Hospital",
    rider: "Emma Williams",
    completedAt: "Yesterday, 21:30",
    status: "Cancelled",
  },
  {
    id: "104",
    reference: "JB-1008",
    pickup: "Morriston Hospital",
    delivery: "Singleton Hospital",
    rider: "Tom Evans",
    completedAt: "Yesterday, 18:05",
    status: "Delivered",
  },
];

function statusBadgeClass(status: JobStatus | CompletedJob["status"]) {
  switch (status) {
    case "New":
      return "border-bb-status-pending-border bg-bb-white text-bb-gray-700 dark:bg-bb-gray-700 dark:text-bb-gray-100";
    case "Assigned":
    case "Accepted":
    case "Collected":
      return "border-bb-status-active-border bg-bb-status-active-bg text-bb-status-active-text dark:bg-bb-navy-light/30 dark:text-blue-200";
    case "Delivered":
      return "bg-bb-success-light text-bb-success dark:bg-bb-success/20 dark:text-green-300";
    case "Escalated":
      return "bg-bb-warning-light text-bb-warning dark:bg-bb-warning/20 dark:text-amber-300";
    case "Cancelled":
      return "bg-bb-error-light text-bb-error dark:bg-bb-error/20 dark:text-red-300";
    default:
      return "";
  }
}

function matchesFilter(job: ActiveJob, tab: FilterTab) {
  switch (tab) {
    case "All":
      return true;
    case "New":
      return job.status === "New";
    case "Assigned":
      return job.status === "Assigned";
    case "In Progress":
      return job.status === "Accepted" || job.status === "Collected";
    case "Escalated":
      return job.status === "Escalated";
    default:
      return false;
  }
}

function matchesSearch(
  query: string,
  reference: string,
  pickup: string,
  delivery: string,
) {
  if (!query.trim()) return true;
  const normalized = query.trim().toLowerCase();
  return (
    reference.toLowerCase().includes(normalized) ||
    pickup.toLowerCase().includes(normalized) ||
    delivery.toLowerCase().includes(normalized)
  );
}

function JobRouteIndicator({
  pickup,
  delivery,
}: {
  pickup: string;
  delivery: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
        <span className="size-2.5 shrink-0 rounded-full bg-bb-navy dark:bg-bb-navy-light" />
        <span className="my-0.5 w-px flex-1 bg-bb-gray-300 dark:bg-bb-gray-500" />
        <span className="size-2.5 shrink-0 rounded-full border-2 border-bb-navy bg-bb-white dark:border-bb-navy-light dark:bg-bb-gray-700" />
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
          {pickup}
        </p>
        <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
          {delivery}
        </p>
      </div>
    </div>
  );
}

function ActiveJobCard({ job }: { job: ActiveJob }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="group block rounded-bb-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 transition-colors hover:bg-bb-gray-50 dark:bg-card dark:ring-bb-gray-700 dark:hover:bg-muted/50">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-medium text-bb-gray-900 dark:text-bb-gray-100">
                {job.reference}
              </span>
              {job.urgent ? (
                <Badge className="bg-bb-warning-light text-bb-warning dark:bg-bb-warning/20 dark:text-amber-300">
                  Urgent
                </Badge>
              ) : null}
            </div>
            <Badge className={cn("shrink-0", statusBadgeClass(job.status))}>
              {job.status}
            </Badge>
          </div>

          <JobRouteIndicator pickup={job.pickup} delivery={job.delivery} />

          <div className="flex items-center justify-between gap-3 border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
            <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
              {job.rider ?? "Unassigned"}
            </p>
            <div className="flex items-center gap-1.5 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span>{job.updatedAt}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <span className="text-sm font-semibold text-bb-cta group-hover:underline dark:text-primary">
              Open
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CompletedJobCard({ job }: { job: CompletedJob }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="group block rounded-bb-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 transition-colors hover:bg-bb-gray-50 dark:bg-card dark:ring-bb-gray-700 dark:hover:bg-muted/50">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-base font-medium text-bb-gray-900 dark:text-bb-gray-100">
              {job.reference}
            </span>
            <Badge className={cn("shrink-0", statusBadgeClass(job.status))}>
              {job.status}
            </Badge>
          </div>

          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            {job.rider}
          </p>

          <JobRouteIndicator pickup={job.pickup} delivery={job.delivery} />

          <div className="flex items-center justify-between gap-3 border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
            <div className="flex items-center gap-1.5 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span>{job.completedAt}</span>
            </div>
            <span className="text-sm font-semibold text-bb-cta group-hover:underline dark:text-primary">
              View
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Jobs — Plasma Controller" }];
}

export default function JobsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, activeRole } = useAuth();
  const canCreate = canCreateJobs(activeRole);
  const isNewJobOpen = location.pathname === "/jobs/new" && canCreate;
  const isAssignOpen = location.pathname === "/jobs/new/assign";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (canCreate) {
      return;
    }
    if (location.pathname !== "/jobs/new") {
      return;
    }
    navigate("/jobs", { replace: true });
  }, [canCreate, location.pathname, navigate, status]);

  function handleNewJobOpenChange(open: boolean) {
    if (!open) {
      navigate(-1);
    }
  }

  function handleAssignOpenChange(open: boolean) {
    if (!open) {
      navigate(-1);
    }
  }

  const filteredActiveJobs = MOCK_ACTIVE_JOBS.filter(
    (job) =>
      matchesFilter(job, activeTab) &&
      matchesSearch(searchQuery, job.reference, job.pickup, job.delivery),
  );

  const filteredCompletedJobs = MOCK_COMPLETED_JOBS.filter((job) =>
    matchesSearch(searchQuery, job.reference, job.pickup, job.delivery),
  );

  const showCompleted = activeTab === "Completed";

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
              Jobs
            </h1>
            <Badge className="bg-bb-navy text-bb-white dark:bg-bb-navy-light">
              {ACTIVE_AREA}
            </Badge>
          </div>
          {canCreate && (
            <Button
              render={<Link to="/jobs/new" />}
              nativeButton={false}
              className="h-11 gap-2 rounded-bb-button px-5 text-base font-bold sm:h-12"
            >
              <Plus aria-hidden="true" />
              New Job
            </Button>
          )}
        </header>

        <div className="relative">
          <label htmlFor="job-search" className="sr-only">
            Search jobs by reference or hospital
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-bb-gray-500 dark:text-bb-gray-400"
            aria-hidden="true"
          />
          <Input
            id="job-search"
            type="search"
            placeholder="Search reference or hospital…"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 pl-10 text-base dark:bg-input/30"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter jobs by status"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "bg-bb-cta text-bb-white dark:bg-primary"
                    : "bg-bb-white text-bb-gray-700 ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:bg-card dark:text-bb-gray-300 dark:ring-bb-gray-700 dark:hover:bg-muted/50",
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {showCompleted ? (
          <section aria-label="Completed jobs">
            {filteredCompletedJobs.length > 0 ? (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredCompletedJobs.map((job) => (
                  <li key={job.id}>
                    <CompletedJobCard job={job} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
                No completed jobs match your search.
              </p>
            )}
          </section>
        ) : (
          <section aria-label="Active jobs">
            {filteredActiveJobs.length > 0 ? (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredActiveJobs.map((job) => (
                  <li key={job.id}>
                    <ActiveJobCard job={job} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
                No jobs match the current filters.
              </p>
            )}
          </section>
        )}
      </div>

      <NewJobDrawer
        open={isNewJobOpen}
        onOpenChange={handleNewJobOpenChange}
        onCreated={() => navigate("/jobs")}
      />
      <AssignRiderDrawer
        open={isAssignOpen}
        onOpenChange={handleAssignOpenChange}
        onBack={() => navigate("/jobs/new")}
        onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)}
        onBackToJobs={() => navigate("/jobs")}
        onCreateAnother={() => navigate("/jobs/new")}
      />
      <Outlet />
    </>
  );
}
