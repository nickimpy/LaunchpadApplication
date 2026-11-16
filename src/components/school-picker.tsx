"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };

/** Lowercase, strip punctuation: "Furness, Horace HS" → "furness horace hs". */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Searchable school picker (ARIA combobox + listbox). Students type any part of
 * the name — "furness", "mastery lenfest", "bonner" — instead of hunting an
 * 80-item alphabetical dropdown. That dropdown is why students typed in
 * schools that were already listed (Horace Furness sits under H, they looked
 * under F). Every word typed must appear somewhere in the name, in any order.
 *
 * The chosen value travels in a hidden input, so it survives React 19's
 * post-action form reset (a hidden input's value IS its attribute). The
 * "Other" option is always offered last so nobody is ever stuck.
 */
export function SchoolPicker({
  label,
  name,
  options,
  otherOption,
  defaultValue = "",
  onChange,
  error,
  hint,
}: {
  label: string;
  name: string;
  options: Option[];
  /** Always-available fallback, e.g. "My school isn't listed — type it in". */
  otherOption: Option;
  defaultValue?: string;
  onChange?: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const errorId = error ? `${id}-error` : undefined;
  const hintId = `${id}-hint`;

  const labelFor = (v: string) =>
    v === otherOption.value ? otherOption.label : (options.find((o) => o.value === v)?.label ?? "");

  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(() => labelFor(defaultValue));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // New data from the server (e.g. after a save) — adopt it.
  const [seed, setSeed] = useState(defaultValue);
  if (seed !== defaultValue) {
    setSeed(defaultValue);
    setValue(defaultValue);
    setQuery(labelFor(defaultValue));
  }

  const matches = useMemo(() => {
    const words = norm(query).split(" ").filter(Boolean);
    // Showing the chosen school's own name: list everything again.
    const showingChoice = value && query === labelFor(value);
    const hits =
      words.length === 0 || showingChoice
        ? options
        : options.filter((o) => {
            const hay = norm(o.label);
            return words.every((w) => hay.includes(w));
          });
    return [...hits, otherOption];
    // labelFor is derived from options/otherOption, already deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value, options, otherOption]);

  const choose = (o: Option) => {
    setValue(o.value);
    setQuery(o.label);
    setOpen(false);
    onChange?.(o.value);
  };

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault(); // pick, don't submit the form
      const o = matches[active];
      if (o) choose(o);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="mb-6">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      <p id={hintId} className="mt-1 text-xs">
        {hint ?? "Start typing any part of your school's name."}
      </p>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}
          autoComplete="off"
          value={query}
          placeholder="e.g. Furness, Mastery Lenfest, Central"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
            // Typing clears a previous pick until they choose again.
            if (value) {
              setValue("");
              onChange?.("");
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className={`mt-1 block w-full rounded-md border bg-white px-3 py-3 text-base text-grey
            focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-dark
            ${error ? "border-orange-dark" : "border-grey-tint1"}`}
        />
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-grey-tint1 bg-white shadow-sm"
          >
            {matches.length === 1 && (
              <li role="presentation" className="px-3 py-1 text-xs">
                No school matches “{query}” — choose the option below to type it in.
              </li>
            )}
            {matches.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                // mousedown, not click: fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-3 text-base ${
                  i === active ? "bg-teal-tint3" : ""
                } ${o.value === otherOption.value ? "border-t border-grey-tint2 italic" : ""}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <input type="hidden" name={name} value={value} />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-bold text-orange-dark">
          {error}
        </p>
      )}
    </div>
  );
}
