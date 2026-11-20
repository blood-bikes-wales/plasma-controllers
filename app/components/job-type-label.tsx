import { Milk } from "lucide-react";

import { type DeliveryJob, formatMilkLitres, isMilkJob } from "~/lib/jobs";
import { cn } from "~/lib/utils";

/**
 * "Milk" label (icon plus text, never colour alone) and the litres, for
 * example "Milk · 2.5 L". Renders nothing for a standard job, so the board and
 * detail only call out jobs that are not the default.
 */
export function JobTypeLabel({
  job,
  className,
}: {
  job: Pick<DeliveryJob, "jobType" | "milkLitres">;
  className?: string;
}) {
  if (!isMilkJob(job)) {
    return null;
  }

  const litres = formatMilkLitres(job.milkLitres);

  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-sm font-semibold text-bb-gray-900 dark:text-bb-gray-100",
        className,
      )}
    >
      <Milk className="size-4 shrink-0" aria-hidden="true" />
      <span>Milk</span>
      {litres ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{litres}</span>
        </>
      ) : null}
    </p>
  );
}
