import { useEffect, useState } from "react";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

const MOCK_HOSPITALS = [
  "Royal Glamorgan Hospital",
  "University Hospital of Wales",
  "Prince Charles Hospital",
  "Royal Gwent Hospital",
  "Nevill Hall Hospital",
  "Bronglais General Hospital",
  "Withybush General Hospital",
  "Morriston Hospital",
  "Singleton Hospital",
  "Princess of Wales Hospital",
] as const;

type NewJobFormState = {
  callerName: string;
  contactNumber: string;
  pickupLocation: string;
  pickupWard: string;
  deliveryLocation: string;
  deliveryWard: string;
  isUrgent: boolean;
  contents: string;
  controllerNotes: string;
};

const EMPTY_FORM: NewJobFormState = {
  callerName: "",
  contactNumber: "",
  pickupLocation: "",
  pickupWard: "",
  deliveryLocation: "",
  deliveryWard: "",
  isUrgent: false,
  contents: "",
  controllerNotes: "",
};

type NewJobDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueToAssign?: (form: NewJobFormState) => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-0 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-4 pt-5">
        <h2 className="text-base font-bold text-bb-gray-900 dark:text-bb-gray-100">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function HospitalSelect({
  id,
  label,
  value,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
        {label}
      </Label>
      <Select value={value || null} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className="h-11 w-full text-base dark:bg-input/30"
        >
          <SelectValue placeholder="Search or select hospital…" />
        </SelectTrigger>
        <SelectContent>
          {MOCK_HOSPITALS.map((hospital) => (
            <SelectItem key={hospital} value={hospital}>
              {hospital}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function NewJobDrawer({
  open,
  onOpenChange,
  onContinueToAssign,
}: NewJobDrawerProps) {
  const [form, setForm] = useState<NewJobFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
    }
  }, [open]);

  function updateField<K extends keyof NewJobFormState>(
    field: K,
    value: NewJobFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleClose() {
    onOpenChange(false);
  }

  function handleContinue() {
    onContinueToAssign?.(form);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:max-w-full sm:max-w-xl data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b border-bb-gray-100 px-5 py-4 text-left dark:border-bb-gray-700">
          <SheetTitle className="text-xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
            New Job
          </SheetTitle>
          <SheetDescription>
            Capture call details while speaking with the hospital. Nothing is
            saved until you assign a rider.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <FormSection title="Call details">
              <div className="space-y-2">
                <Label
                  htmlFor="caller-name"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Caller name
                </Label>
                <Input
                  id="caller-name"
                  autoComplete="name"
                  value={form.callerName}
                  onChange={(event) =>
                    updateField("callerName", event.target.value)
                  }
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Dr. Patel"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="contact-number"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Contact number
                </Label>
                <Input
                  id="contact-number"
                  type="tel"
                  autoComplete="tel"
                  value={form.contactNumber}
                  onChange={(event) =>
                    updateField("contactNumber", event.target.value)
                  }
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. 029 2074 7747"
                />
              </div>
            </FormSection>

            <FormSection title="Pickup">
              <HospitalSelect
                id="pickup-location"
                label="Pickup location"
                value={form.pickupLocation}
                onValueChange={(value) => updateField("pickupLocation", value)}
              />
              <div className="space-y-2">
                <Label
                  htmlFor="pickup-ward"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Ward or department{" "}
                  <span className="font-normal text-bb-gray-500">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="pickup-ward"
                  value={form.pickupWard}
                  onChange={(event) =>
                    updateField("pickupWard", event.target.value)
                  }
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. A&E, Ward 4B"
                />
              </div>
            </FormSection>

            <FormSection title="Delivery">
              <HospitalSelect
                id="delivery-location"
                label="Delivery location"
                value={form.deliveryLocation}
                onValueChange={(value) =>
                  updateField("deliveryLocation", value)
                }
              />
              <div className="space-y-2">
                <Label
                  htmlFor="delivery-ward"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Ward or department{" "}
                  <span className="font-normal text-bb-gray-500">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="delivery-ward"
                  value={form.deliveryWard}
                  onChange={(event) =>
                    updateField("deliveryWard", event.target.value)
                  }
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Pathology, ICU"
                />
              </div>
            </FormSection>

            <FormSection title="Urgency & contents">
              <div
                className={cn(
                  "flex min-h-14 items-center justify-between gap-4 rounded-xl border-2 p-4 transition-colors",
                  form.isUrgent
                    ? "border-bb-warning bg-bb-warning-light dark:border-bb-warning dark:bg-bb-warning/20"
                    : "border-bb-gray-200 bg-bb-white dark:border-bb-gray-700 dark:bg-card",
                )}
              >
                <div className="space-y-0.5">
                  <Label
                    htmlFor="is-urgent"
                    className="text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100"
                  >
                    Is urgent
                  </Label>
                  <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                    {form.isUrgent
                      ? "Priority dispatch required"
                      : "Standard delivery window"}
                  </p>
                </div>
                <Switch
                  id="is-urgent"
                  checked={form.isUrgent}
                  onCheckedChange={(checked) =>
                    updateField("isUrgent", checked)
                  }
                  className="size-7 shrink-0 data-[size=default]:h-7 data-[size=default]:w-12"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="contents"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Item or contents description
                </Label>
                <Input
                  id="contents"
                  value={form.contents}
                  onChange={(event) =>
                    updateField("contents", event.target.value)
                  }
                  className="h-11 text-base dark:bg-input/30"
                  placeholder="e.g. Blood samples, medical notes"
                />
              </div>
            </FormSection>

            <FormSection title="Controller notes">
              <div className="space-y-2">
                <Label
                  htmlFor="controller-notes"
                  className="text-bb-gray-700 dark:text-bb-gray-300"
                >
                  Extra instructions
                </Label>
                <Textarea
                  id="controller-notes"
                  value={form.controllerNotes}
                  onChange={(event) =>
                    updateField("controllerNotes", event.target.value)
                  }
                  className="min-h-28 text-base dark:bg-input/30"
                  placeholder="Access codes, contact on arrival, timing constraints…"
                />
              </div>
            </FormSection>
          </div>

          <SheetFooter className="shrink-0 gap-3 border-t border-bb-gray-100 bg-bb-white px-5 py-4 dark:border-bb-gray-700 dark:bg-card">
            <Button
              type="button"
              className="h-12 w-full rounded-bb-button text-base font-bold"
              onClick={handleContinue}
            >
              Continue to assign
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-base font-medium text-bb-gray-500"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export type { NewJobFormState };
