import { type KeyboardEvent, useEffect, useId, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { PlaceLocation } from "~/lib/jobs";
import { googlePlacesLookup, type PlacesLookup } from "~/lib/places";
import { mostUsedLocations, recentLocations } from "~/lib/saved-locations";

const SUGGEST_DEBOUNCE_MS = 250;

type PlaceLocationFieldProps = {
  id: string;
  label: string;
  value: PlaceLocation | null;
  onChange: (value: PlaceLocation | null) => void;
  error?: string;
  lookup?: PlacesLookup;
};

function SavedLocationList({
  heading,
  locations,
  onSelect,
}: {
  heading: string;
  locations: PlaceLocation[];
  onSelect: (location: PlaceLocation) => void;
}) {
  if (locations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-bb-gray-500 uppercase dark:text-bb-gray-400">
        {heading}
      </p>
      <ul className="space-y-1">
        {locations.map((location) => (
          <li key={location.placeId}>
            <button
              type="button"
              className="flex min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-bb-gray-900 hover:bg-bb-gray-50 dark:text-bb-gray-100 dark:hover:bg-muted/50"
              onClick={() => onSelect(location)}
            >
              {location.address}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlaceLocationField({
  id,
  label,
  value,
  onChange,
  error,
  lookup = googlePlacesLookup,
}: PlaceLocationFieldProps) {
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { placeId: string; description: string }[]
  >([]);
  const [searchError, setSearchError] = useState<string | undefined>();
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (value) {
      setSuggestions([]);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const handle = window.setTimeout(() => {
      void lookup
        .suggest(trimmed)
        .then((next) => {
          setSuggestions(next);
          setSearchError(undefined);
        })
        .catch((caught: unknown) => {
          setSuggestions([]);
          if (caught instanceof Error && caught.message.length > 0) {
            setSearchError(caught.message);
            return;
          }
          setSearchError("Place search failed. Try again.");
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [lookup, query, value]);

  async function selectSuggestion(placeId: string, description: string) {
    setResolving(true);
    setSearchError(undefined);
    try {
      const location = await lookup.details(placeId);
      onChange(location);
      setQuery("");
      setSuggestions([]);
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.message.length > 0) {
        setSearchError(caught.message);
        return;
      }
      setSearchError(`Could not load ${description}. Try another.`);
    } finally {
      setResolving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const first = suggestions[0];
    if (!first || resolving) {
      return;
    }

    void selectSuggestion(first.placeId, first.description);
  }

  const recent = recentLocations();
  const recentIds = new Set(recent.map((location) => location.placeId));
  const mostUsed = mostUsedLocations().filter(
    (location) => !recentIds.has(location.placeId),
  );
  const hasSaved = recent.length > 0 || mostUsed.length > 0;
  const showSaved =
    focused && !value && query.trim().length === 0 && !resolving && hasSaved;
  const showSuggestions = !value && suggestions.length > 0;
  const fieldError = error ?? searchError;

  if (value) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
          {label}
        </Label>
        <div className="flex items-start gap-2">
          <Input
            id={id}
            readOnly
            value={value.address}
            aria-invalid={!!error}
            className="h-11 flex-1 text-base dark:bg-input/30"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0 rounded-bb-button px-4 text-sm font-semibold"
            onClick={() => onChange(null)}
          >
            Change
          </Button>
        </div>
        <FieldError message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
        {label}
      </Label>
      <Input
        id={id}
        role="combobox"
        aria-expanded={showSuggestions || showSaved}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={!!fieldError}
        autoComplete="off"
        value={query}
        disabled={resolving}
        placeholder="Search for a hospital or address…"
        className="h-11 text-base dark:bg-input/30"
        onChange={(event) => {
          setQuery(event.target.value);
          setSearchError(undefined);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={handleKeyDown}
      />
      {showSuggestions ? (
        <div
          id={listboxId}
          role="listbox"
          className="space-y-1 rounded-xl bg-bb-white p-1 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              role="option"
              className="flex min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-bb-gray-900 hover:bg-bb-gray-50 dark:text-bb-gray-100 dark:hover:bg-muted/50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                void selectSuggestion(
                  suggestion.placeId,
                  suggestion.description,
                )
              }
            >
              {suggestion.description}
            </button>
          ))}
          <p className="px-3 py-1.5 text-right text-xs text-bb-gray-500 dark:text-bb-gray-400">
            Powered by Google
          </p>
        </div>
      ) : null}
      {showSaved ? (
        <div
          id={listboxId}
          className="space-y-4 rounded-xl bg-bb-white p-3 ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700"
        >
          <SavedLocationList
            heading="Recent"
            locations={recent}
            onSelect={onChange}
          />
          <SavedLocationList
            heading="Most used"
            locations={mostUsed}
            onSelect={onChange}
          />
        </div>
      ) : null}
      <FieldError message={fieldError} />
    </div>
  );
}
