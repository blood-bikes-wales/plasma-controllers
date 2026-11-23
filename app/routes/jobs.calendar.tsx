import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { useAuth } from "~/lib/auth";
import {
  type DeliveryJob,
  displayJobReference,
  fetchJobs,
  formatScheduledCollection,
  isRecurringJob,
  isUpcomingJob,
  jobErrorMessage,
  orderActiveJobsForBoard,
  upcomingCollectionAt,
} from "~/lib/jobs";

import type { Route } from "./+types/jobs.calendar";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Jobs calendar — Plasma Controller" }];
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function JobsCalendarPage() {
  const { status } = useAuth();
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchJobs("active")
      .then((next) => {
        if (!cancelled) {
          setJobs(next);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(jobErrorMessage(caught, "Unable to load jobs."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const groups = useMemo(() => {
    const scheduled = orderActiveJobsForBoard(jobs).filter(
      (job) => upcomingCollectionAt(job) !== null,
    );
    const byDay = new Map<string, DeliveryJob[]>();
    for (const job of scheduled) {
      const at = upcomingCollectionAt(job);
      if (!at) {
        continue;
      }
      const key = dayKey(at);
      const list = byDay.get(key) ?? [];
      list.push(job);
      byDay.set(key, list);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [jobs]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-bb-cta hover:underline dark:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to jobs
        </Link>
      </div>

      <header>
        <h1 className="text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Jobs calendar
        </h1>
        <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
          Arranged collections from the active board, grouped by day.
        </p>
      </header>

      {loading ? (
        <p className="py-12 text-center text-bb-gray-500">Loading…</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-base font-medium text-bb-error">
          {error}
        </p>
      ) : null}
      {!loading && !error && groups.length === 0 ? (
        <p className="py-12 text-center text-bb-gray-500">
          No arranged collections on the active board.
        </p>
      ) : null}

      <div className="space-y-6">
        {groups.map(([key, dayJobs]) => (
          <section key={key} aria-label={dayHeading(`${key}T12:00:00`)}>
            <h2 className="mb-3 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
              {dayHeading(`${key}T12:00:00`)}
              {dayJobs.some((job) => isUpcomingJob(job)) ? (
                <span className="ml-2 text-sm font-semibold text-bb-gray-500">
                  Upcoming
                </span>
              ) : null}
            </h2>
            <ul className="space-y-3">
              {dayJobs.map((job) => (
                <li key={job.id}>
                  <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div>
                        <Link
                          to={`/jobs/${job.id}`}
                          className="font-mono text-base font-medium text-bb-cta hover:underline dark:text-primary"
                        >
                          {displayJobReference(job)}
                        </Link>
                        <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
                          Collection{" "}
                          {formatScheduledCollection(upcomingCollectionAt(job))}
                        </p>
                        <p className="text-sm text-bb-gray-500">
                          {job.collection.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRecurringJob(job) ? (
                          <Badge className="border border-bb-navy bg-bb-white text-bb-navy">
                            Recurring
                          </Badge>
                        ) : null}
                        <Badge>{job.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
