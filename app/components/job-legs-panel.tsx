import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { type DeliveryJob, displayJobReference } from "~/lib/jobs";
import { cn } from "~/lib/utils";

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

function LegSummary({ leg }: { leg: DeliveryJob }) {
  return (
    <div className="space-y-1 text-sm text-bb-gray-600 dark:text-bb-gray-300">
      <p>{leg.collection.address}</p>
      <p>{leg.delivery.address}</p>
    </div>
  );
}

export function JobLegsPanel({
  legs,
  defaultExpanded = false,
}: {
  legs: DeliveryJob[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (legs.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between px-0 py-1 text-left font-semibold text-bb-gray-900 hover:bg-transparent dark:text-bb-gray-100"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>Relay legs ({legs.length})</span>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
        )}
      </Button>

      {expanded ? (
        <ul className="mt-3 space-y-3">
          {legs.map((leg) => (
            <li
              key={leg.id}
              className="rounded-lg bg-bb-gray-50 p-3 ring-1 ring-bb-gray-200 dark:bg-muted/30 dark:ring-bb-gray-700"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <Link
                  to={`/jobs/${leg.id}`}
                  className="font-mono text-sm font-semibold text-bb-cta hover:underline dark:text-primary"
                >
                  {displayJobReference(leg)}
                </Link>
                <Badge className={cn("shrink-0", statusBadgeClass(leg.status))}>
                  {leg.status}
                </Badge>
              </div>
              <LegSummary leg={leg} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
