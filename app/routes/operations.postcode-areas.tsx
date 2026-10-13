import { MapPinned, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useAuth } from "~/lib/auth";
import { canManagePostcodeAreas } from "~/lib/capabilities";
import {
  createPostcodeArea,
  fetchPostcodeAreas,
  importPostcodeAreas,
  type PostcodeAreaMapping,
  postcodeAreaErrorMessage,
  updatePostcodeArea,
} from "~/lib/postcode-areas";

import type { Route } from "./+types/operations.postcode-areas";

type MappingFormState = {
  outboundPostcode: string;
  areaCode: string;
  areaFullName: string;
  active: boolean;
};

const EMPTY_FORM: MappingFormState = {
  outboundPostcode: "",
  areaCode: "",
  areaFullName: "",
  active: true,
};

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Postcode areas — Plasma Controller" }];
}

function formFromMapping(mapping: PostcodeAreaMapping): MappingFormState {
  return {
    outboundPostcode: mapping.outboundPostcode,
    areaCode: mapping.areaCode,
    areaFullName: mapping.areaFullName,
    active: mapping.active,
  };
}

export default function OperationsPostcodeAreasPage() {
  const { activeRole } = useAuth();
  const canManage = canManagePostcodeAreas(activeRole);

  const [mappings, setMappings] = useState<PostcodeAreaMapping[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PostcodeAreaMapping | null>(null);
  const [form, setForm] = useState<MappingFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const next = await fetchPostcodeAreas({
      q: search || undefined,
      includeInactive,
    });
    setMappings(next);
  }, [includeInactive, search]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            postcodeAreaErrorMessage(caught, "Unable to load postcode areas."),
          );
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
  }, [canManage, load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEdit(mapping: PostcodeAreaMapping) {
    setEditing(mapping);
    setForm(formFromMapping(mapping));
    setFormError(null);
    setDrawerOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setStatusMessage(null);

    const payload = {
      outboundPostcode: form.outboundPostcode.trim().toUpperCase(),
      areaCode: form.areaCode.trim().toUpperCase(),
      areaFullName: form.areaFullName.trim(),
      active: form.active,
    };

    try {
      if (editing) {
        const updated = await updatePostcodeArea(editing.id, payload);
        setMappings((current) =>
          current
            .map((row) => (row.id === updated.id ? updated : row))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setStatusMessage(`Updated ${updated.outboundPostcode}.`);
      }

      if (!editing) {
        const created = await createPostcodeArea(payload);
        setMappings((current) =>
          [...current, created].sort((a, b) => a.sortOrder - b.sortOrder),
        );
        setStatusMessage(`Added ${created.outboundPostcode}.`);
      }

      setDrawerOpen(false);
    } catch (caught: unknown) {
      setFormError(postcodeAreaErrorMessage(caught, "Unable to save mapping."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(mapping: PostcodeAreaMapping) {
    setError(null);
    setStatusMessage(null);

    try {
      const updated = await updatePostcodeArea(mapping.id, {
        active: !mapping.active,
      });
      setMappings((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      setStatusMessage(
        updated.active
          ? `Activated ${updated.outboundPostcode}.`
          : `Deactivated ${updated.outboundPostcode}.`,
      );
    } catch (caught: unknown) {
      setError(
        postcodeAreaErrorMessage(caught, "Unable to update mapping status."),
      );
    }
  }

  async function handleImport(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setImporting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await importPostcodeAreas(file);
      await load();
      setStatusMessage(
        `Import complete: ${result.created} created, ${result.updated} updated.`,
      );
    } catch (caught: unknown) {
      setError(postcodeAreaErrorMessage(caught, "Unable to import file."));
    } finally {
      setImporting(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4 px-5 py-6">
        <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Operations
        </h1>
        <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
          You do not have permission to manage postcode area mappings.
        </p>
      </div>
    );
  }

  const drawerTitle = editing ? "Edit mapping" : "Add mapping";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 px-5 pb-5 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MapPinned className="size-6 text-bb-cta dark:text-primary" />
              <h2 className="text-xl font-bold text-bb-gray-900 dark:text-bb-gray-100">
                Postcode areas
              </h2>
            </div>
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Map UK outward postcodes to charity service areas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.txt,text/csv,text/tab-separated-values"
              className="sr-only"
              disabled={importing}
              onChange={(event) => {
                void handleImport(event.target.files);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-bb-button px-4"
              disabled={importing}
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {importing ? "Importing…" : "Import CSV"}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-bb-button px-4"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Add mapping
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="postcode-area-search">Search</Label>
          <Input
            id="postcode-area-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Postcode, area code, or name"
            className="h-11"
          />
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300">
            <input
              type="checkbox"
              className="size-5 rounded border-bb-gray-300 accent-bb-cta"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            Show inactive mappings
          </label>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-bb-error">
            {error}
          </p>
        ) : null}

        {statusMessage ? (
          <p role="status" className="text-sm font-medium text-bb-success">
            {statusMessage}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            Loading mappings…
          </p>
        ) : null}

        {!isLoading && mappings.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            No mappings match the current filters.
          </p>
        ) : null}

        <div className="space-y-3">
          {mappings.map((mapping) => (
            <Card
              key={mapping.id}
              className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
            >
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-mono text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                      {mapping.outboundPostcode}
                    </h2>
                    <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
                      {mapping.areaCode} · {mapping.areaFullName}
                    </p>
                  </div>
                  <Badge
                    className={
                      mapping.active
                        ? "bg-bb-success-light text-bb-success"
                        : "bg-bb-gray-100 text-bb-gray-700"
                    }
                  >
                    {mapping.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-bb-button px-4"
                    onClick={() => openEdit(mapping)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-4"
                    onClick={() => {
                      void handleToggleActive(mapping);
                    }}
                  >
                    {mapping.active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-bb-gray-100 px-5 py-4 dark:border-bb-gray-700">
            <SheetTitle>{drawerTitle}</SheetTitle>
            <SheetDescription>
              Outward codes are normalised (e.g. CF14). Area code and full name
              identify the charity service area.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="mapping-postcode">Outbound postcode</Label>
                <Input
                  id="mapping-postcode"
                  value={form.outboundPostcode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      outboundPostcode: event.target.value,
                    }))
                  }
                  className="h-11 font-mono uppercase"
                  placeholder="e.g. CF14"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapping-area-code">Area code</Label>
                <Input
                  id="mapping-area-code"
                  value={form.areaCode}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      areaCode: event.target.value,
                    }))
                  }
                  className="h-11 uppercase"
                  placeholder="e.g. E"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapping-area-name">Area full name</Label>
                <Input
                  id="mapping-area-name"
                  value={form.areaFullName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      areaFullName: event.target.value,
                    }))
                  }
                  className="h-11"
                  placeholder="e.g. East"
                  required
                />
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300">
                <input
                  type="checkbox"
                  className="size-5 rounded border-bb-gray-300 accent-bb-cta"
                  checked={form.active}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                />
                Active
              </label>
              <FieldError message={formError ?? undefined} />
            </div>
            <SheetFooter className="gap-3 border-t border-bb-gray-100 px-5 py-4 dark:border-bb-gray-700">
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-bb-button text-base font-bold"
              >
                {submitting ? "Saving…" : "Save mapping"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-bb-button"
                onClick={() => setDrawerOpen(false)}
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
