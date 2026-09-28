import { useId, type ComponentPropsWithoutRef } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "id"> & {
  label: string;
  options: SelectOption[];
  hint?: string;
  error?: string;
  focusVisible?: boolean;
  className?: string;
};

const FOCUS =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk";
const FORCED_FOCUS = "outline outline-[3px] outline-offset-2 outline-chalk";

/**
 * DESIGN.md §4 select. Native `<select>` (not Radix Select) for phone
 * reliability — it opens the platform's own picker UI, which is always
 * correct for one-thumb use, instead of a custom listbox we'd have to get
 * right for every keyboard and screen reader ourselves.
 */
export function Select({
  label,
  options,
  hint,
  error,
  focusVisible,
  className,
  ...selectProps
}: SelectProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-body-strong text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          {...selectProps}
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={cx(
            "h-[52px] w-full appearance-none rounded-control border-[1.5px] bg-surface px-4 pr-12 text-body text-ink",
            error ? "border-over" : "border-edge",
            "disabled:opacity-50",
            focusVisible ? FORCED_FOCUS : FOCUS,
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <CaretDown
          size={20}
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-2"
        />
      </div>
      {hint && !error ? (
        <span id={hintId} className="text-meta text-ink-2">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="text-meta text-over">
          {error}
        </span>
      ) : null}
    </div>
  );
}
