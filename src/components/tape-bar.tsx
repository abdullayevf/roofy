import { cx } from "@/lib/cx";

export type TapeBarProps = {
  /** Accessible name for the progressbar role, e.g. "Sheet install progress". */
  label: string;
  /** Progress as a whole percent, 0-100. */
  percent: number;
  /** Where the forecast lands, as a whole percent, if it's tracking to go over. */
  forecastPercent?: number;
  /**
   * Text shown at the forecast marker, e.g. "Forecast $4,775.00". Manager
   * only — a foreman never sees a dollar forecast (DESIGN.md, flows.md),
   * so a foreman-facing TapeBar is simply given no `forecastPercent`/
   * `forecastLabel` at all rather than a money-free version of this prop.
   */
  forecastLabel?: string;
  className?: string;
};

const TICK_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * DESIGN.md §4 tape bar: 12 px steel-tape track (surface, 1 px ink outline),
 * tape fill, ink ticks every 10% (taller at 50%), the % also printed as
 * text, and an `over`-coloured marker (taller than the track) at the
 * forecast point with its own label — never a red bar.
 */
export function TapeBar({ label, percent, forecastPercent, forecastLabel, className }: TapeBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const clampedForecast =
    forecastPercent === undefined ? undefined : Math.max(0, Math.min(100, forecastPercent));

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
            className="relative h-[12px] rounded-full border border-ink bg-surface overflow-visible"
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
                  "absolute top-1/2 -translate-y-1/2 w-px bg-ink",
                  stop === 50 ? "h-[12px]" : "h-[8px]",
                )}
                style={{ left: `${stop}%` }}
              />
            ))}
            {clampedForecast !== undefined ? (
              <div
                aria-hidden="true"
                className="absolute w-[1.5px] bg-over"
                style={{ left: `${clampedForecast}%`, top: "-4px", bottom: "-4px" }}
              />
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-figure num text-ink">{clamped}% done</span>
      </div>
      {clampedForecast !== undefined && forecastLabel ? (
        <div className="flex items-center gap-3">
          <div className="relative h-4 flex-1">
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-meta text-over"
              style={{ left: `${clampedForecast}%` }}
            >
              {forecastLabel}
            </span>
          </div>
          <span aria-hidden="true" className="invisible shrink-0 text-figure num">
            {clamped}%
          </span>
        </div>
      ) : null}
    </div>
  );
}
