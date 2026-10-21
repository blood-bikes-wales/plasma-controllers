import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { FieldError } from "~/components/field-error";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

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

  const selected = options.find((option) => option.value === value);
  const filtered = filterOptions(options, query);
  const showSuggestions = focused && !value && filtered.length > 0;

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [showSuggestions]);

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setQuery("");
    setFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    const first = filtered[0];
    if (!first) {
      return;
    }

    selectOption(first);
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
        aria-autocomplete="list"
        aria-invalid={!!error}
        autoComplete="off"
        value={query}
        disabled={disabled || options.length === 0}
        placeholder={placeholder}
        className="h-11 px-3 text-base dark:bg-input/30"
        onChange={(event) => setQuery(event.target.value)}
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
          {filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              className={OPTION_BUTTON_CLASS}
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
