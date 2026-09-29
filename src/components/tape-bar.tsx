import { WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";

export type TapeBarTone = "watch" | "over";

export type TapeBarProps = {
  /** Accessible name for the progressbar role, e.g. "Sheet install progress". */
  label: string;
  /** Progress as a whole percent, 0-100. */
  percent: number;
  /** Where the forecast lands, as a whole percent, if it's tracking to go over (or already is). */
  forecastPercent?: number;
  /** Short text at the forecast marker, e.g. "Forecast". */
  forecastLabel?: string;
  /**
   * `watch` (amber, with a warning diamond) = trending over; `over` (red,
   * with a warning circle) = actually over. Colour never alone.
   */
  tone?: TapeBarTone;
  /**
   * The plain-language summary, e.g. "$775.00 over — forecast $4,775.00 of
   * $4,000.00". Manager only: a foreman-facing TapeBar is given no forecast,
   * label or note at all rather than a money-free version of them.
   */
  note?: string;
  className?: string;
};

const TICK_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const TONE = {
  watch: { marker: "bg-watch", text: "text-watch", icon: WarningDiamond },
  over: { marker: "bg-over", text: "text-over", icon: WarningCircle },
} as const;

/**
 * DESIGN.md §4 tape bar: 12 px steel-tape track (surface, 1 px ink outline),
 * tape fill, ink ticks every 10% (the 50% tick clearly taller), the % printed
 * as text, and a marker at the forecast point — 4 px wide, taller than the
 * track, labelled where it sits. Trending over is amber (`watch`) with a
 * warning icon; actually over is `over`. Never a red bar.
 */
export function TapeBar({
  label,
  percent,
  forecastPercent,
  forecastLabel,
  tone = "watch",
  note,
  className,
}: TapeBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const clampedForecast =
    forecastPercent === undefined ? undefined : Math.max(0, Math.min(100, forecastPercent));
  const t = TONE[tone];

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${clamped}% done`}
            className="relative h-[12px] overflow-visible rounded-full border border-ink bg-surface"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-tape"
              style={{ width: `${clamped}%` }}
            />
            {TICK_STOPS.map((stop) => (
              <span
                key={stop}
                aria-hidden="true"
                className={cx(
                  "absolute top-1/2 w-px -translate-y-1/2 bg-ink",
                  stop === 50 ? "h-4" : "h-1.5",
                )}
                style={{ left: `${stop}%` }}
              />
            ))}
            {clampedForecast !== undefined ? (
              <div
                aria-hidden="true"
                className={cx("absolute w-1 -translate-x-1/2 rounded-full", t.marker)}
                style={{ left: `${clampedForecast}%`, top: "-4px", bottom: "-4px" }}
              />
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-figure num text-ink">{clamped}% done</span>
      </div>
      {clampedForecast !== undefined && forecastLabel ? (
        <div className="flex items-center gap-3">
          <div className="relative h-5 flex-1">
            <span
              className={cx(
                "absolute whitespace-nowrap text-meta",
                t.text,
                clampedForecast >= 70 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${clampedForecast}%` }}
            >
              {forecastLabel}
            </span>
          </div>
          <span aria-hidden="true" className="invisible shrink-0 text-figure num">
            {clamped}% done
          </span>
        </div>
      ) : null}
      {note ? (
        <p className={cx("flex items-start justify-end gap-2 text-right text-figure num", t.text)}>
          {tone === "over" ? (
            <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
          ) : (
            <WarningDiamond size={24} aria-hidden="true" className="shrink-0" />
          )}
          <span className="min-w-0">{note}</span>
        </p>
      ) : null}
    </div>
  );
}
