import { Heart } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import type { DeliveryJob } from "~/lib/jobs";
import { cn } from "~/lib/utils";

/**
 * "Bereavement" badge (icon plus text, never colour alone) for a milk job that
 * is a bereavement. It only tells riders and drivers to be sensitive, so it
 * uses the calm Navy tokens, never red or error colours, and says nothing more.
 * Renders nothing when the flag is off or absent (an API that predates it).
 */
export function BereavementBadge({
  job,
  className,
}: {
  job: Pick<DeliveryJob, "isBereavement">;
  className?: string;
}) {
  if (job.isBereavement !== true) {
    return null;
  }

  return (
    <Badge
      className={cn(
        "h-6 gap-1.5 border-bb-navy/30 bg-bb-navy/10 px-2.5 text-xs font-semibold text-bb-navy dark:border-bb-navy-light dark:bg-bb-navy-light/30 dark:text-blue-200",
        className,
      )}
    >
      <Heart aria-hidden="true" />
      Bereavement
    </Badge>
  );
}
