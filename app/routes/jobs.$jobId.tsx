import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";

import { FieldError } from "~/components/field-error";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useAuth } from "~/lib/auth";
import { canManageJobs } from "~/lib/capabilities";
import {
  allowedActionsForJob,
  cancelJob,
  type DeliveryJob,
  defaultDateTimeLocalValue,
  displayJobReference,
  fetchJobById,
  formatJobCreatedAt,
  fromDateTimeLocalValue,
  jobErrorMessage,
  performJobAction,
} from "~/lib/jobs";
import { type ActiveShift, fetchActiveShifts } from "~/lib/shifts";
import { cn } from "~/lib/utils";
import { fieldErrors } from "~/lib/validation";

import type { Route } from "./+types/jobs.$jobId";

const allocateSchema = z.object({
  shiftId: z.string().min(1, "Select a rider on an active shift"),
});

const collectSchema = z
  .object({
    contentsConfirmed: z.enum(["yes", "no"], {
      message: "Confirm whether the contents match the job",
    }),
    suitablySealed: z.enum(["yes", "no"], {
      message: "Confirm whether the package is suitably sealed",
    }),
    sealNumber: z.string(),
    receiptNumber: z.string().trim().min(1, "Enter a receipt number"),
    collectedAt: z.string().trim().min(1, "Enter a collection time"),
  })
  .superRefine((data, ctx) => {
    if (data.suitablySealed !== "yes") {
      return;
    }

    if (data.sealNumber.trim() === "") {
      ctx.addIssue({
        code: "custom",
        path: ["sealNumber"],
        message: "Enter a seal number when the package is suitably sealed",
      });
    }
  });

const deliverSchema = z.object({
  recipient: z.string().trim().min(1, "Enter the recipient"),
  deliveredAt: z.string().trim().min(1, "Enter a delivery time"),
});

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

function JobRouteSummary({ job }: { job: DeliveryJob }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1.5" aria-hidden="true">
        <span className="size-2.5 shrink-0 rounded-full bg-bb-navy dark:bg-bb-navy-light" />
        <span className="my-0.5 w-px flex-1 bg-bb-gray-300 dark:bg-bb-gray-500" />
        <span className="size-2.5 shrink-0 rounded-full border-2 border-bb-navy bg-bb-white dark:border-bb-navy-light dark:bg-bb-gray-700" />
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
          {job.collection.address}
        </p>
        <p className="text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
          {job.delivery.address}
        </p>
      </div>
    </div>
  );
}

function AllocateJobForm({
  shifts,
  isSubmitting,
  onSubmit,
}: {
  shifts: ActiveShift[];
  isSubmitting: boolean;
  onSubmit: (shiftId: string) => Promise<void>;
}) {
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError(null);

    const parsed = allocateSchema.safeParse({ shiftId: shiftId ?? "" });
    const errors = fieldErrors(parsed);
    if (!parsed.success) {
      setFieldError(errors.shiftId ?? "Select a rider on an active shift");
      return;
    }

    await onSubmit(parsed.data.shiftId);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="allocate-shift">Active shift rider</Label>
        <Select
          value={shiftId}
          onValueChange={(value) => {
            setShiftId(value);
            setFieldError(null);
          }}
        >
          <SelectTrigger id="allocate-shift" className="w-full">
            <SelectValue placeholder="Select a rider on duty" />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((shift) => (
              <SelectItem key={shift.id} value={shift.id}>
                {shift.riderName} · {shift.bikeRegistration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={fieldError} />
        {shifts.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            No riders are currently on an active shift.
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={isSubmitting || shifts.length === 0}>
        Allocate rider
      </Button>
    </form>
  );
}

function CollectJobForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (payload: {
    contentsConfirmed: boolean;
    suitablySealed: boolean;
    sealNumber?: string;
    receiptNumber: string;
    collectedAt: string;
  }) => Promise<void>;
}) {
  const [contentsConfirmed, setContentsConfirmed] = useState<string | null>(
    null,
  );
  const [suitablySealed, setSuitablySealed] = useState<string | null>(null);
  const [sealNumber, setSealNumber] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectedAt, setCollectedAt] = useState(defaultDateTimeLocalValue());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = collectSchema.safeParse({
      contentsConfirmed: contentsConfirmed ?? "",
      suitablySealed: suitablySealed ?? "",
      sealNumber,
      receiptNumber,
      collectedAt,
    });

    const nextErrors = fieldErrors(parsed);
    if (!parsed.success) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      contentsConfirmed: parsed.data.contentsConfirmed === "yes",
      suitablySealed: parsed.data.suitablySealed === "yes",
      sealNumber:
        parsed.data.suitablySealed === "yes"
          ? parsed.data.sealNumber.trim()
          : undefined,
      receiptNumber: parsed.data.receiptNumber,
      collectedAt: fromDateTimeLocalValue(parsed.data.collectedAt) ?? "",
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="contents-confirmed">Contents confirmed</Label>
        <Select value={contentsConfirmed} onValueChange={setContentsConfirmed}>
          <SelectTrigger id="contents-confirmed">
            <SelectValue placeholder="Select yes or no" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.contentsConfirmed} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="suitably-sealed">Suitably sealed</Label>
        <Select value={suitablySealed} onValueChange={setSuitablySealed}>
          <SelectTrigger id="suitably-sealed">
            <SelectValue placeholder="Select yes or no" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <FieldError message={errors.suitablySealed} />
      </div>

      {suitablySealed === "yes" ? (
        <div className="space-y-2">
          <Label htmlFor="seal-number">Seal number</Label>
          <Input
            id="seal-number"
            value={sealNumber}
            onChange={(event) => setSealNumber(event.target.value)}
          />
          <FieldError message={errors.sealNumber} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="receipt-number">Receipt number</Label>
        <Input
          id="receipt-number"
          value={receiptNumber}
          onChange={(event) => setReceiptNumber(event.target.value)}
        />
        <FieldError message={errors.receiptNumber} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="collected-at">Collection time</Label>
        <Input
          id="collected-at"
          type="datetime-local"
          value={collectedAt}
          onChange={(event) => setCollectedAt(event.target.value)}
        />
        <FieldError message={errors.collectedAt} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Record collection
      </Button>
    </form>
  );
}

function DeliverJobForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (payload: {
    recipient: string;
    deliveredAt: string;
  }) => Promise<void>;
}) {
  const [recipient, setRecipient] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(defaultDateTimeLocalValue());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const parsed = deliverSchema.safeParse({ recipient, deliveredAt });
    const nextErrors = fieldErrors(parsed);
    if (!parsed.success) {
      setErrors(nextErrors);
      return;
    }

    await onSubmit({
      recipient: parsed.data.recipient,
      deliveredAt: fromDateTimeLocalValue(parsed.data.deliveredAt) ?? "",
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="recipient">Recipient</Label>
        <Input
          id="recipient"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        />
        <FieldError message={errors.recipient} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="delivered-at">Delivery time</Label>
        <Input
          id="delivered-at"
          type="datetime-local"
          value={deliveredAt}
          onChange={(event) => setDeliveredAt(event.target.value)}
        />
        <FieldError message={errors.deliveredAt} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        Record delivery
      </Button>
    </form>
  );
}

function CancelJobForm({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    await onSubmit(trimmed.length > 0 ? trimmed : undefined);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="cancel-reason">Reason (optional)</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
        />
      </div>
      <Button type="submit" variant="destructive" disabled={isSubmitting}>
        Cancel job
      </Button>
    </form>
  );
}

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Job ${params.jobId} — Plasma Controller` }];
}

export default function JobDetailPage() {
  const { jobId = "" } = useParams();
  const { status, activeRole } = useAuth();
  const canManage = canManageJobs(activeRole);

  const [job, setJob] = useState<DeliveryJob | null>(null);
  const [shifts, setShifts] = useState<ActiveShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextJob, nextShifts] = await Promise.all([
      fetchJobById(jobId),
      fetchActiveShifts(),
    ]);
    setJob(nextJob);
    setShifts(nextShifts);
  }, [jobId]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(jobErrorMessage(caught, "Unable to load job."));
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
  }, [load, status]);

  async function runAction(action: () => Promise<DeliveryJob>) {
    setActionError(null);
    setIsSubmitting(true);
    try {
      const updated = await action();
      setJob(updated);
    } catch (caught: unknown) {
      setActionError(jobErrorMessage(caught, "Unable to update this job."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
        Loading job…
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

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-base text-bb-gray-500 dark:text-bb-gray-400">
          Job not found.
        </p>
        <Button render={<Link to="/jobs" />} nativeButton={false}>
          Back to jobs
        </Button>
      </div>
    );
  }

  const allowed = allowedActionsForJob(job);
  const reference = displayJobReference(job);
  const createdLabel = formatJobCreatedAt(job.createdAt);

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

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            {reference}
          </h1>
          {createdLabel ? (
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Created {createdLabel}
            </p>
          ) : null}
        </div>
        <Badge className={cn("shrink-0", statusBadgeClass(job.status))}>
          {job.status}
        </Badge>
      </header>

      <Card className="rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
        <CardContent className="space-y-5">
          <JobRouteSummary job={job} />
          <div className="space-y-1 text-sm text-bb-gray-600 dark:text-bb-gray-300">
            <p>
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Sender:
              </span>{" "}
              {job.sender.name}
              {job.sender.organisation ? ` · ${job.sender.organisation}` : ""}
            </p>
            <p>
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Contents:
              </span>{" "}
              {job.contents}
            </p>
          </div>
          {job.allocatedRider ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              <span className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                Allocated rider:
              </span>{" "}
              {job.allocatedRider.name}
            </p>
          ) : null}
          {job.collectionRecord ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              Collected · receipt {job.collectionRecord.receiptNumber}
            </p>
          ) : null}
          {job.deliveryRecord ? (
            <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
              Delivered to {job.deliveryRecord.recipient}
            </p>
          ) : null}
          {job.cancellation?.reason ? (
            <p className="text-sm text-bb-error">
              Cancelled: {job.cancellation.reason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {actionError ? (
        <p role="alert" className="text-sm font-medium text-bb-error">
          {actionError}
        </p>
      ) : null}

      {canManage && allowed.includes("allocate") ? (
        <section
          aria-label="Allocate job"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Allocate rider
          </h2>
          <AllocateJobForm
            shifts={shifts}
            isSubmitting={isSubmitting}
            onSubmit={(shiftId) =>
              runAction(() => performJobAction(job.id, "allocate", { shiftId }))
            }
          />
        </section>
      ) : null}

      {canManage && allowed.includes("collect") ? (
        <section
          aria-label="Record collection"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Record collection
          </h2>
          <CollectJobForm
            isSubmitting={isSubmitting}
            onSubmit={(payload) =>
              runAction(() => performJobAction(job.id, "collect", payload))
            }
          />
        </section>
      ) : null}

      {canManage && allowed.includes("deliver") ? (
        <section
          aria-label="Record delivery"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Record delivery
          </h2>
          <DeliverJobForm
            isSubmitting={isSubmitting}
            onSubmit={(payload) =>
              runAction(() => performJobAction(job.id, "deliver", payload))
            }
          />
        </section>
      ) : null}

      {canManage && allowed.includes("cancel") ? (
        <section
          aria-label="Cancel job"
          className="rounded-bb-card bg-bb-white p-5 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <h2 className="mb-4 text-lg font-bold text-bb-gray-900 dark:text-bb-gray-100">
            Cancel job
          </h2>
          <CancelJobForm
            isSubmitting={isSubmitting}
            onSubmit={(reason) =>
              runAction(() => cancelJob(job.id, { reason }))
            }
          />
        </section>
      ) : null}
    </div>
  );
}
