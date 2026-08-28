import { CheckCircle2, MapPin, Phone, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { StatusBadge } from "~/components/status-badge";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { cn } from "~/lib/utils";

const assignRiderFormSchema = z.object({
  riderId: z.string().min(1, "Select a rider to continue"),
});

type RiderStatus = "available" | "busy" | "offline";

type Rider = {
  id: string;
  name: string;
  status: RiderStatus;
  locationHint: string;
  distance: string;
  activeJobs: number;
  phone: string;
  area: string;
};

type AssignJobSummary = {
  id: string;
  reference: string;
  pickup: string;
  delivery: string;
  urgent: boolean;
  area: string;
};

const DEFAULT_JOB_SUMMARY: AssignJobSummary = {
  id: "draft-1",
  reference: "JB-1043",
  pickup: "Royal Glamorgan Hospital",
  delivery: "University Hospital of Wales",
  urgent: true,
  area: "South Area",
};

const MOCK_RIDERS: Rider[] = [
  {
    id: "r1",
    name: "Sarah Jones",
    status: "available",
    locationHint: "Near Royal Glamorgan",
    distance: "2.4 mi",
    activeJobs: 0,
    phone: "07700900101",
    area: "South Area",
  },
  {
    id: "r2",
    name: "Mike Davies",
    status: "available",
    locationHint: "Cardiff city centre",
    distance: "5.1 mi",
    activeJobs: 1,
    phone: "07700900102",
    area: "South Area",
  },
  {
    id: "r3",
    name: "Emma Williams",
    status: "busy",
    locationHint: "En route to UHW",
    distance: "8.3 mi",
    activeJobs: 2,
    phone: "07700900103",
    area: "South Area",
  },
  {
    id: "r4",
    name: "Tom Evans",
    status: "offline",
    locationHint: "Last seen Pontypridd",
    distance: "—",
    activeJobs: 0,
    phone: "07700900104",
    area: "South Area",
  },
  {
    id: "r5",
    name: "Lisa Morgan",
    status: "available",
    locationHint: "Near Prince Charles Hospital",
    distance: "6.7 mi",
    activeJobs: 1,
    phone: "07700900105",
    area: "South Area",
  },
  {
    id: "r6",
    name: "James Price",
    status: "available",
    locationHint: "Newport",
    distance: "12.0 mi",
    activeJobs: 0,
    phone: "07700900106",
    area: "North Area",
  },
];

const SHEET_CONTENT_CLASS =
  "flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl";

function riderStatusLabel(status: RiderStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "busy":
      return "Busy";
    case "offline":
      return "Offline";
  }
}

function riderStatusClass(status: RiderStatus) {
  switch (status) {
    case "available":
      return "bg-bb-success-light text-bb-success dark:bg-bb-success/20 dark:text-green-300";
    case "busy":
      return "bg-bb-warning-light text-bb-warning dark:bg-bb-warning/20 dark:text-amber-300";
    case "offline":
      return "bg-bb-gray-100 text-bb-gray-500 dark:bg-bb-gray-700 dark:text-bb-gray-400";
  }
}

function JobRouteSummary({
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

function RiderCard({
  rider,
  selected,
  onSelect,
}: {
  rider: Rider;
  selected: boolean;
  onSelect: () => void;
}) {
  const isOffline = rider.status === "offline";

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Select ${rider.name}`}
      disabled={isOffline}
      onClick={onSelect}
      className={cn(
        "w-full rounded-bb-card text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "ring-2 ring-bb-cta dark:ring-primary"
          : "ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:ring-bb-gray-700 dark:hover:bg-muted/30",
      )}
    >
      <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none dark:bg-card">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <UserRound
                className="size-5 shrink-0 text-bb-navy dark:text-bb-navy-light"
                aria-hidden="true"
              />
              <span className="truncate text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                {rider.name}
              </span>
            </div>
            <Badge className={cn("shrink-0", riderStatusClass(rider.status))}>
              {riderStatusLabel(rider.status)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              {rider.locationHint} · {rider.distance}
            </span>
            <span>
              {rider.activeJobs === 0
                ? "No active jobs"
                : `${rider.activeJobs} active job${rider.activeJobs === 1 ? "" : "s"}`}
            </span>
          </div>

          <div className="flex justify-end">
            <Button
              render={<a href={`tel:${rider.phone}`} />}
              nativeButton={false}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 px-3"
              onClick={(event) => event.stopPropagation()}
            >
              <Phone className="size-4" aria-hidden="true" />
              Call
            </Button>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function AssignSuccessState({
  job,
  riderName,
  onOpenJob,
  onBackToJobs,
  onCreateAnother,
}: {
  job: AssignJobSummary;
  riderName: string;
  onOpenJob: () => void;
  onBackToJobs: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
      <CheckCircle2
        className="size-[72px] text-bb-success"
        aria-hidden="true"
      />
      <h2 className="mt-6 text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
        Rider assigned
      </h2>
      <p className="mt-2 font-mono text-lg font-medium text-bb-gray-900 dark:text-bb-gray-100">
        {job.reference}
      </p>
      <p className="mt-1 text-base text-bb-gray-700 dark:text-bb-gray-300">
        {riderName}
      </p>
      <StatusBadge variant="success" className="mt-4 px-3 py-1 text-sm">
        Assigned
      </StatusBadge>

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <Button
          type="button"
          className="h-12 w-full rounded-bb-button text-base font-bold"
          onClick={onOpenJob}
        >
          Open job
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full rounded-bb-button text-base font-semibold"
          onClick={onBackToJobs}
        >
          Back to jobs
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full text-base font-medium"
          onClick={onCreateAnother}
        >
          Create another job
        </Button>
      </div>
    </div>
  );
}

type AssignRiderDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: AssignJobSummary;
  onBack?: () => void;
  onOpenJob?: (jobId: string) => void;
  onBackToJobs?: () => void;
  onCreateAnother?: () => void;
};

export function AssignRiderDrawer({
  open,
  onOpenChange,
  job = DEFAULT_JOB_SUMMARY,
  onBack,
  onOpenJob,
  onBackToJobs,
  onCreateAnother,
}: AssignRiderDrawerProps) {
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const areaRiders = MOCK_RIDERS.filter((rider) => rider.area === job.area);
  const selectedRider = areaRiders.find(
    (rider) => rider.id === selectedRiderId,
  );
  const isValid = assignRiderFormSchema.safeParse({
    riderId: selectedRiderId ?? "",
  }).success;

  useEffect(() => {
    if (!open) {
      setSelectedRiderId(null);
      setIsConfirmed(false);
    }
  }, [open]);

  function handleClose() {
    onOpenChange(false);
  }

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    handleClose();
  }

  function handleConfirm() {
    const result = assignRiderFormSchema.safeParse({
      riderId: selectedRiderId ?? "",
    });
    if (!result.success || !selectedRider) return;

    setIsConfirmed(true);
    console.log("Assigned rider", { job, rider: selectedRider });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={SHEET_CONTENT_CLASS}>
        {isConfirmed && selectedRider ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Assignment confirmed</SheetTitle>
              <SheetDescription>
                {job.reference} assigned to {selectedRider.name}
              </SheetDescription>
            </SheetHeader>
            <AssignSuccessState
              job={job}
              riderName={selectedRider.name}
              onOpenJob={() => onOpenJob?.(job.id)}
              onBackToJobs={() => onBackToJobs?.()}
              onCreateAnother={() => onCreateAnother?.()}
            />
          </>
        ) : (
          <>
            <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
              <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
                Assign rider
              </SheetTitle>
              <SheetDescription>
                Choose an available rider for this job in {job.area}.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-bb-gray-100 bg-bb-gray-50 px-5 py-4 dark:border-bb-gray-700 dark:bg-muted/30">
                <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium text-bb-gray-900 dark:text-bb-gray-100">
                        {job.reference}
                      </span>
                      {job.urgent ? (
                        <Badge className="bg-bb-warning-light text-bb-warning dark:bg-bb-warning/20 dark:text-amber-300">
                          Urgent
                        </Badge>
                      ) : (
                        <Badge className="bg-bb-navy text-bb-white dark:bg-bb-navy-light">
                          Routine
                        </Badge>
                      )}
                    </div>
                    <JobRouteSummary
                      pickup={job.pickup}
                      delivery={job.delivery}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="mb-4 space-y-1">
                  <h2 className="text-base font-bold text-bb-gray-900 dark:text-bb-gray-100">
                    Available riders
                  </h2>
                  <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                    Showing riders in {job.area}
                  </p>
                </div>

                {areaRiders.length > 0 ? (
                  <div className="space-y-3">
                    {areaRiders.map((rider) => (
                      <div key={rider.id}>
                        <RiderCard
                          rider={rider}
                          selected={selectedRiderId === rider.id}
                          onSelect={() => setSelectedRiderId(rider.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
                    No riders available in this area.
                  </p>
                )}
              </div>

              <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
                <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                  {selectedRider ? (
                    <>
                      Selected:{" "}
                      <span className="font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                        {selectedRider.name}
                      </span>
                    </>
                  ) : (
                    "No rider selected"
                  )}
                </p>
                <Button
                  type="button"
                  className="h-12 w-full rounded-bb-button text-base font-bold"
                  disabled={!isValid}
                  onClick={handleConfirm}
                >
                  Confirm assignment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-bb-button text-base font-semibold"
                  onClick={handleBack}
                >
                  Back
                </Button>
              </SheetFooter>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export type { AssignJobSummary, AssignRiderDrawerProps };
