import { ListChecks, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useAuth } from "~/lib/auth";
import { canManageJobContents } from "~/lib/capabilities";
import {
  createJobContent,
  fetchJobContents,
  jobContentErrorMessage,
  type ManagedJobContent,
  sortJobContents,
  updateJobContent,
} from "~/lib/job-contents";

import type { Route } from "./+types/operations.job-contents";

const NAME_MAX = 100;
const NAME_REQUIRED = "Enter a name for the contents";
const NAME_TOO_LONG = `Name must be ${NAME_MAX} characters or fewer`;

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Job contents — Plasma Controller" }];
}

/** The message to show for a typed name, or null when it is fine to send. */
function nameProblem(name: string): string | null {
  if (name === "") {
    return NAME_REQUIRED;
  }

  return name.length > NAME_MAX ? NAME_TOO_LONG : null;
}

export default function OperationsJobContentsPage() {
  const { activeRole } = useAuth();
  const canManage = canManageJobContents(activeRole);

  const [entries, setEntries] = useState<ManagedJobContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Why the list could not be loaded. Kept apart from `error` so adding or
  // changing an entry never hides it: a partial list must not look complete.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newNameError, setNewNameError] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey only exists to re-run this fetch ("Try again").
  useEffect(() => {
    if (!canManage) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void fetchJobContents()
      .then((next) => {
        if (!cancelled) {
          setEntries(sortJobContents(next as ManagedJobContent[]));
          setLoadError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setLoadError(
            jobContentErrorMessage(caught, "Unable to load job contents."),
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
  }, [canManage, reloadKey]);

  function replaceEntry(updated: ManagedJobContent) {
    setEntries((current) =>
      sortJobContents(
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      ),
    );
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    const problem = nameProblem(name);
    if (problem) {
      setNewNameError(problem);
      return;
    }

    setAdding(true);
    setNewNameError(undefined);
    setStatusMessage(null);
    setError(null);

    try {
      const created = await createJobContent({ name });
      setEntries((current) => sortJobContents([...current, created]));
      setNewName("");
      setStatusMessage(`Added ${created.name}.`);
    } catch (caught: unknown) {
      setNewNameError(
        jobContentErrorMessage(caught, "Unable to add contents."),
      );
    } finally {
      setAdding(false);
    }
  }

  function startRename(entry: ManagedJobContent) {
    setRenamingId(entry.id);
    setRenameValue(entry.name);
    setRenameError(undefined);
    setStatusMessage(null);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameError(undefined);
  }

  async function handleRename(
    event: React.FormEvent,
    entry: ManagedJobContent,
  ) {
    event.preventDefault();
    const name = renameValue.trim();
    const problem = nameProblem(name);
    if (problem) {
      setRenameError(problem);
      return;
    }

    setSaving(true);
    setRenameError(undefined);

    try {
      const updated = await updateJobContent(entry.id, { name });
      replaceEntry(updated);
      setRenamingId(null);
      setStatusMessage(`Renamed to ${updated.name}.`);
    } catch (caught: unknown) {
      setRenameError(
        jobContentErrorMessage(caught, "Unable to rename contents."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(entry: ManagedJobContent) {
    setError(null);
    setStatusMessage(null);

    try {
      const updated = await updateJobContent(entry.id, {
        active: !entry.active,
      });
      replaceEntry(updated);
      setStatusMessage(
        updated.active
          ? `Reactivated ${updated.name}.`
          : `Deactivated ${updated.name}.`,
      );
    } catch (caught: unknown) {
      setError(
        jobContentErrorMessage(caught, "Unable to update the contents entry."),
      );
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4 px-5 py-6">
        <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Operations
        </h1>
        <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
          You do not have permission to manage job contents.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 px-5 pb-5 pt-4">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="size-6 text-bb-cta dark:text-primary" />
            <h2 className="text-xl font-bold text-bb-gray-900 dark:text-bb-gray-100">
              Job contents
            </h2>
          </div>
          <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
            Controllers choose from this list on New Job. Deactivating an entry
            hides it from the list but keeps it on existing jobs.
          </p>
        </div>

        <form noValidate className="space-y-2" onSubmit={handleAdd}>
          <Label
            htmlFor="new-job-content"
            className="text-bb-gray-700 dark:text-bb-gray-300"
          >
            New contents
          </Label>
          <div className="flex items-start gap-2">
            <Input
              id="new-job-content"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setNewNameError(undefined);
              }}
              aria-invalid={!!newNameError}
              className="h-11 flex-1 text-base dark:bg-input/30"
              placeholder="e.g. Blood samples"
            />
            <Button
              type="submit"
              disabled={adding}
              className="h-11 shrink-0 rounded-bb-button px-4"
            >
              <Plus className="size-4" />
              {adding ? "Adding…" : "Add contents"}
            </Button>
          </div>
          <FieldError message={newNameError} />
        </form>

        {loadError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm font-medium text-bb-error">
              {loadError}
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-bb-button px-4"
              disabled={isLoading}
              onClick={() => setReloadKey((count) => count + 1)}
            >
              Try again
            </Button>
          </div>
        ) : null}

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
            Loading contents…
          </p>
        ) : null}

        {!isLoading && !loadError && entries.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            No contents have been set up yet. Add one above.
          </p>
        ) : null}

        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
                <CardContent>
                  {renamingId === entry.id ? (
                    <form
                      noValidate
                      className="space-y-2"
                      onSubmit={(event) => void handleRename(event, entry)}
                    >
                      <Label
                        htmlFor={`rename-${entry.id}`}
                        className="text-bb-gray-700 dark:text-bb-gray-300"
                      >
                        Rename {entry.name}
                      </Label>
                      <Input
                        id={`rename-${entry.id}`}
                        value={renameValue}
                        onChange={(event) => {
                          setRenameValue(event.target.value);
                          setRenameError(undefined);
                        }}
                        aria-invalid={!!renameError}
                        className="h-11 text-base dark:bg-input/30"
                      />
                      <FieldError message={renameError} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="submit"
                          disabled={saving}
                          className="h-11 rounded-bb-button px-4"
                        >
                          {saving ? "Saving…" : "Save name"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-bb-button px-4"
                          onClick={cancelRename}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
                          {entry.name}
                        </span>
                        {entry.active ? null : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-bb-button px-4"
                          aria-label={`Rename ${entry.name}`}
                          onClick={() => startRename(entry)}
                        >
                          Rename
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 rounded-bb-button px-4"
                          aria-label={`${entry.active ? "Deactivate" : "Reactivate"} ${entry.name}`}
                          onClick={() => void handleToggleActive(entry)}
                        >
                          {entry.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
