import { Clock, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { AssignRiderDrawer } from "~/components/assign-rider-drawer";
import { JobLegsPanel } from "~/components/job-legs-panel";
import { NewJobDrawer } from "~/components/new-job-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useAuth } from "~/lib/auth";
import { canCreateJobs } from "~/lib/capabilities";
import {
  type DeliveryJob,
  displayJobReference,
  fetchJobs,
  formatJobCreatedAt,
  jobErrorMessage,
} from "~/lib/jobs";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/jobs";

type FilterTab = "All" | "New" | "Allocated" | "Collected" | "Completed";

const FILTER_TABS: FilterTab[] = [
  "All",
  "New",
  "Allocated",
  "Collected",
  "Completed",
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "New":
      return "border-bb-status-pending-border bg-bb-white text-bb-gray-700 dark:bg-bb-gray-700 dark:text-bb-gray-100";
    case "Allocated":
    case "Collected":
      return "border-bb-status-active-border bg-bb-status-active-bg text-bb-status-active-text dark:bg-bb-navy-light/30 dark:text-blue-200";
    case "Delivered":
      return "bg-bb-success-light text-bb-success dark:bg-bb-success/20 dark:text-green-300";
    case "Cancelled":
      return "bg-bb-error-light text-bb-error dark:bg-bb-error/20 dark:text-red-300";
    default:
      return "border-bb-gray-200 bg-bb-white text-bb-gray-700 dark:bg-bb-gray-700 dark:text-bb-gray-100";
  }
}

function tabClass(isActive: boolean) {
  if (isActive) {
    return "bg-bb-cta text-bb-white dark:bg-primary";
  }

  return "bg-bb-white text-bb-gray-700 ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:bg-card dark:text-bb-gray-300 dark:ring-bb-gray-700 dark:hover:bg-muted/50";
}

function matchesStatusTab(job: DeliveryJob, tab: FilterTab) {
  switch (tab) {
    case "All":
    case "Completed":
      return true;
    default:
      return job.status === tab;
  }
}

function jobsForTab(
  tab: FilterTab,
  active: DeliveryJob[],
  completed: DeliveryJob[],
) {
  if (tab === "Completed") {
    return completed;
  }

  return active;
}

function emptyMessage(tab: FilterTab, hasSourceJobs: boolean) {
  if (tab === "Completed" && !hasSourceJobs) {
    return "No completed jobs.";
  }

  if (tab === "Completed") {
    return "No completed jobs match your search.";
  }

  if (!hasSourceJobs) {
    return "No active jobs.";
  }

  return "No jobs match the current filters.";
}

function sectionLabel(tab: FilterTab) {
  if (tab === "Completed") {
    return "Completed jobs";
  }

  return "Active jobs";
}

function actionLabel(tab: FilterTab) {
  if (tab === "Completed") {
    return "View";
  }

  return "Open";
}

function matchesSearch(query: string, job: DeliveryJob) {
  if (!query.trim()) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  return (
    displayJobReference(job).toLowerCase().includes(normalized) ||
    job.collection.address.toLowerCase().includes(normalized) ||
    job.delivery.address.toLowerCase().includes(normalized)
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

function CreatedAt({ createdAt }: { createdAt: string | null }) {
  const label = formatJobCreatedAt(createdAt);
  if (!label) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-bb-gray-500 dark:text-bb-gray-400">
      <Clock className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function JobCard({
  job,
  actionLabel,
}: {
  job: DeliveryJob;
  actionLabel: string;
}) {
  const reference = displayJobReference(job);

  return (
    <Card className="h-full rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 transition-colors hover:bg-bb-gray-50 dark:bg-card dark:ring-bb-gray-700 dark:hover:bg-muted/50">
      <CardContent className="space-y-4">
        <Link
          to={`/jobs/${job.id}`}
          className="group block rounded-bb-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-base font-medium text-bb-gray-900 dark:text-bb-gray-100">
                {reference}
                {job.isRelay ? (
                  <span className="ml-2 text-xs font-sans font-semibold uppercase tracking-wide text-bb-cta dark:text-primary">
                    Relay
                  </span>
                ) : null}
              </span>
              <Badge className={cn("shrink-0", statusBadgeClass(job.status))}>
                {job.status}
              </Badge>
            </div>

            <JobRouteIndicator
              pickup={job.collection.address}
              delivery={job.delivery.address}
            />

            <div className="flex items-center justify-between gap-3 border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
              <CreatedAt createdAt={job.createdAt} />
              <span className="text-sm font-semibold text-bb-cta group-hover:underline dark:text-primary">
                {actionLabel}
              </span>
            </div>
          </div>
        </Link>

        {job.isRelay && job.legs && job.legs.length > 0 ? (
          <JobLegsPanel legs={job.legs} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function JobsBoard({
  isLoading,
  error,
  jobs,
  emptyMessage,
  sectionLabel,
  actionLabel,
}: {
  isLoading: boolean;
  error: string | null;
  jobs: DeliveryJob[];
  emptyMessage: string;
  sectionLabel: string;
  actionLabel: string;
}) {
  if (isLoading) {
    return (
      <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
        Loading jobs…
      </p>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="py-12 text-center text-base font-medium text-bb-error"
      >
        {error}
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <section aria-label={sectionLabel}>
        <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
          {emptyMessage}
        </p>
      </section>
    );
  }

  return (
    <section aria-label={sectionLabel}>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <li key={job.id}>
            <JobCard job={job} actionLabel={actionLabel} />
          </li>
        ))}
      </ul>
    </section>
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
  const isDetailRoute =
    /^\/jobs\/[^/]+$/.test(location.pathname) &&
    location.pathname !== "/jobs/new";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [activeJobs, setActiveJobs] = useState<DeliveryJob[]>([]);
  const [completedJobs, setCompletedJobs] = useState<DeliveryJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextActive, nextCompleted] = await Promise.all([
      fetchJobs("active"),
      fetchJobs("completed"),
    ]);
    setActiveJobs(nextActive);
    setCompletedJobs(nextCompleted);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (isDetailRoute) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(jobErrorMessage(caught, "Unable to load jobs."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isDetailRoute, load, status]);

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

  function handleCreated() {
    navigate("/jobs");
    void load();
  }

  const sourceJobs = jobsForTab(activeTab, activeJobs, completedJobs);
  const visibleJobs = sourceJobs.filter(
    (job) =>
      matchesStatusTab(job, activeTab) && matchesSearch(searchQuery, job),
  );

  if (isDetailRoute) {
    return <Outlet />;
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            Jobs
          </h1>
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
                  tabClass(isActive),
                )}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <JobsBoard
          isLoading={isLoading}
          error={error}
          jobs={visibleJobs}
          emptyMessage={emptyMessage(activeTab, sourceJobs.length > 0)}
          sectionLabel={sectionLabel(activeTab)}
          actionLabel={actionLabel(activeTab)}
        />
      </div>

      <NewJobDrawer
        open={isNewJobOpen}
        onOpenChange={handleNewJobOpenChange}
        onCreated={handleCreated}
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
