import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { PlaceLocation } from "~/lib/jobs";
import { googlePlacesLookup, type PlacesLookup } from "~/lib/places";
import {
  addressWithPostcode,
  findUkPostcode,
  postcodeToShow,
} from "~/lib/postcode";
import { mostUsedLocations, recentLocations } from "~/lib/saved-locations";

const SUGGEST_DEBOUNCE_MS = 250;

/** Google autocomplete has no postcode, so details are fetched for this many suggestions at most. */
const SUGGESTION_POSTCODE_LIMIT = 5;

const OPTION_BUTTON_CLASS =
  "flex min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-bb-gray-900 hover:bg-bb-gray-50 dark:text-bb-gray-100 dark:hover:bg-muted/50";

const SUGGESTION_PANEL_CLASS =
  "space-y-1 rounded-xl border border-bb-gray-200 bg-bb-white p-1 dark:border-bb-gray-700 dark:bg-card";

const SAVED_PANEL_CLASS =
  "space-y-4 rounded-xl border border-bb-gray-200 bg-bb-white p-3 dark:border-bb-gray-700 dark:bg-card";

type PlaceLocationFieldProps = {
  id: string;
  label: string;
  value: PlaceLocation | null;
  onChange: (value: PlaceLocation | null) => void;
  error?: string;
  lookup?: PlacesLookup;
};

function OptionLabel({
  text,
  postcode,
}: {
  text: string;
  postcode: string | null;
}) {
  if (!postcode) {
    return text;
  }

  return (
    <span className="flex flex-col">
      <span>{text}</span>
      <span className="text-xs font-normal text-bb-gray-500 dark:text-bb-gray-400">
        {postcode}
      </span>
    </span>
  );
}

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
              className={OPTION_BUTTON_CLASS}
              onClick={() => onSelect(location)}
            >
              <OptionLabel
                text={location.address}
                postcode={postcodeToShow(location.address, location.postcode)}
              />
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
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { placeId: string; description: string }[]
  >([]);
  const [postcodes, setPostcodes] = useState<Record<string, string>>({});
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

  // Fill in the postcode for the visible suggestions whose text has none. The
  // lookup caches details per place id, so each suggestion is fetched once.
  useEffect(() => {
    let cancelled = false;

    for (const suggestion of suggestions.slice(0, SUGGESTION_POSTCODE_LIMIT)) {
      if (findUkPostcode(suggestion.description)) {
        continue;
      }

      void lookup
        .details(suggestion.placeId)
        .then((location) => {
          const postcode = location.postcode?.trim();
          if (cancelled || !postcode) {
            return;
          }

          setPostcodes((current) =>
            current[suggestion.placeId] === postcode
              ? current
              : { ...current, [suggestion.placeId]: postcode },
          );
        })
        .catch(() => {
          // The option simply shows no postcode; choosing it reports any error.
        });
    }

    return () => {
      cancelled = true;
    };
  }, [lookup, suggestions]);

  async function selectSuggestion(placeId: string, description: string) {
    setResolving(true);
    setSearchError(undefined);
    try {
      const location = await lookup.details(placeId);
      // Keep the autocomplete label so hospitals show their name, not only the street.
      const postcode = location.postcode?.trim() || findUkPostcode(description);
      onChange({
        ...location,
        address: description,
        ...(postcode ? { postcode } : {}),
      });
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

  useEffect(() => {
    if (!showSuggestions && !showSaved) {
      return;
    }

    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showSuggestions, showSaved]);

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
            value={addressWithPostcode(value.address, value.postcode)}
            aria-invalid={!!error}
            className="h-11 flex-1 px-3 text-base dark:bg-input/30"
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
        className="h-11 px-3 text-base dark:bg-input/30"
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
          ref={listRef}
          id={listboxId}
          role="listbox"
          className={SUGGESTION_PANEL_CLASS}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              role="option"
              className={OPTION_BUTTON_CLASS}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                void selectSuggestion(
                  suggestion.placeId,
                  suggestion.description,
                )
              }
            >
              <OptionLabel
                text={suggestion.description}
                postcode={postcodeToShow(
                  suggestion.description,
                  postcodes[suggestion.placeId],
                )}
              />
            </button>
          ))}
          <p className="px-3 py-1.5 text-right text-xs text-bb-gray-500 dark:text-bb-gray-400">
            Powered by Google
          </p>
        </div>
      ) : null}
      {showSaved ? (
        <div ref={listRef} id={listboxId} className={SAVED_PANEL_CLASS}>
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
