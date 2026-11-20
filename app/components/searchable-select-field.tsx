import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectFieldProps = {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  error?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

const OPTION_BUTTON_CLASS =
  "flex min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-bb-gray-900 hover:bg-bb-gray-50 dark:text-bb-gray-100 dark:hover:bg-muted/50";

const SUGGESTION_PANEL_CLASS =
  "space-y-1 rounded-xl border border-bb-gray-200 bg-bb-white p-1 dark:border-bb-gray-700 dark:bg-card";

function filterOptions(
  options: SearchableSelectOption[],
  query: string,
): SearchableSelectOption[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return options;
  }

  return options.filter((option) =>
    option.label.toLowerCase().includes(trimmed),
  );
}

export function SearchableSelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "Search or select…",
  error,
  emptyMessage,
  disabled = false,
}: SearchableSelectFieldProps) {
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  // The option highlighted with the arrow keys, kept by VALUE (never by
  // position) so a list that changes under the user (options refetched, the
  // filter narrowed) cannot move the highlight onto a different option.
  const [activeValue, setActiveValue] = useState<string | null>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = filterOptions(options, query);
  const showSuggestions = focused && !value && filtered.length > 0;
  // Where the highlight sits in the current list: -1 when nothing is
  // highlighted or the highlighted option is no longer listed.
  const activeIndex =
    activeValue === null
      ? -1
      : filtered.findIndex((option) => option.value === activeValue);

  // Forget a highlight whose option has left the list, so it cannot come back
  // by surprise if that option later returns.
  useEffect(() => {
    if (activeValue !== null && activeIndex === -1) {
      setActiveValue(null);
    }
  }, [activeValue, activeIndex]);

  // Keep the highlighted option visible when arrowing through a long list.
  useEffect(() => {
    if (!showSuggestions || activeIndex < 0) {
      return;
    }

    const option = listRef.current?.querySelector('[aria-selected="true"]');
    if (option && typeof option.scrollIntoView === "function") {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [showSuggestions, activeIndex]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    const list = listRef.current;
    if (list && typeof list.scrollIntoView === "function") {
      list.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [showSuggestions]);

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery("");
    setActiveValue(null);
    setFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // An IME (or an Android predictive keyboard, which reports keyCode 229) uses
    // Enter and the arrows to pick its own candidates. That is never a choice
    // here, so leave the event alone.
    if (event.nativeEvent.isComposing || event.keyCode === 229) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length === 0) {
        return;
      }

      setFocused(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const from = activeIndex;
      const next =
        from === -1
          ? step === 1
            ? 0
            : filtered.length - 1
          : (from + step + filtered.length) % filtered.length;
      setActiveValue(filtered[next].value);
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    // Never submit an enclosing form from here.
    event.preventDefault();

    // Selecting can commit a choice at once (for example allocating a job), so
    // Enter only counts when it is deliberate: an option highlighted with the
    // arrow keys (and still listed), or a typed filter whose first match is
    // taken. Enter on an empty box with nothing highlighted does nothing.
    const highlighted = activeIndex >= 0 ? filtered[activeIndex] : undefined;
    const chosen =
      highlighted ?? (query.trim() === "" ? undefined : filtered[0]);
    if (!chosen) {
      return;
    }

    selectOption(chosen);
  }

  if (selected) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="text-bb-gray-700 dark:text-bb-gray-300">
          {label}
        </Label>
        <div className="flex items-start gap-2">
          <Input
            id={id}
            readOnly
            value={selected.label}
            aria-invalid={!!error}
            className="h-11 flex-1 px-3 text-base dark:bg-input/30"
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
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
        aria-expanded={showSuggestions}
        aria-controls={listboxId}
        aria-activedescendant={
          showSuggestions && activeIndex >= 0
            ? `${listboxId}-${activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-invalid={!!error}
        autoComplete="off"
        value={query}
        disabled={disabled || options.length === 0}
        placeholder={placeholder}
        className="h-11 px-3 text-base dark:bg-input/30"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveValue(null);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setFocused(false);
            setActiveValue(null);
          }, 150);
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
          {filtered.map((option, index) => (
            <button
              key={option.value}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={cn(
                OPTION_BUTTON_CLASS,
                index === activeIndex && "bg-bb-gray-50 dark:bg-muted/50",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {options.length === 0 && emptyMessage ? (
        <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
          {emptyMessage}
        </p>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}
