import { formatEstimatedTime } from "~/lib/jobs";

/**
 * One "Estimated collection: Today, 09:30" line. Renders nothing when there is
 * no estimate, so a job without one shows no line at all.
 */
export function EstimatedTime({
  label,
  estimatedAt,
}: {
  label: string;
  estimatedAt: string | null | undefined;
}) {
  const formatted = formatEstimatedTime(estimatedAt);
  if (!formatted) {
    return null;
  }

  return (
    <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
      {label}: {formatted}
    </p>
  );
}
