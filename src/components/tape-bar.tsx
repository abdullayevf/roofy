import { cx } from "@/lib/cx";

export type TapeBarProps = {
  /** Accessible name for the progressbar role, e.g. "Sheet install progress". */
  label: string;
  /** Progress as a whole percent, 0-100. */
  percent: number;
  /** Where the forecast lands, as a whole percent, if it's tracking to go over. */
  forecastPercent?: number;
  className?: string;
};

const TICK_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * DESIGN.md §4 tape bar: 12 px steel-tape track (surface, 1 px ink outline),
 * tape fill, ink ticks every 10% (taller at 50%), the % also printed as
 * text, and an optional `over`-coloured marker at the forecast point,
 * labelled "Forecast" — never a red bar.
 */
export function TapeBar({ label, percent, forecastPercent, className }: TapeBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${clamped}%`}
        className="relative h-[12px] flex-1 rounded-full bg-surface border border-ink overflow-visible"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-tape" style={{ width: `${clamped}%` }} />
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
        {forecastPercent !== undefined ? (
          <div
            aria-hidden="true"
            className="absolute -top-1 -bottom-1 w-[1.5px] bg-over"
            style={{ left: `${Math.max(0, Math.min(100, forecastPercent))}%` }}
          />
        ) : null}
      </div>
      <span className="text-figure num shrink-0 text-ink">{clamped}%</span>
      {forecastPercent !== undefined ? <span className="text-meta text-over shrink-0">Forecast</span> : null}
    </div>
  );
}
