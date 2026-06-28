import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-bb-chip px-2 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        active:
          "border border-bb-status-active-border bg-bb-status-active-bg text-bb-status-active-text",
        pending:
          "border border-bb-status-pending-border bg-bb-white text-bb-gray-700",
        success: "bg-bb-success-light text-bb-success",
        error: "bg-bb-error-light text-bb-error",
      },
    },
    defaultVariants: {
      variant: "active",
    },
  },
);

function StatusBadge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof statusBadgeVariants>) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { StatusBadge, statusBadgeVariants };
