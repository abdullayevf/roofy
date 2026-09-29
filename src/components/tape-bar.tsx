import { WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { keepAmountsTogether } from "@/lib/text";

export type TapeBarTone = "watch" | "over";

export type TapeBarProps = {
  /** Accessible name for the progressbar role, e.g. "Sheet install progress". */
  label: string;
  /** Progress as a whole percent, 0-100. */
  percent: number;
  /** Where the forecast lands, as a whole percent, if it's tracking to go over (or already is). */
  forecastPercent?: number;
  /** Short text anchored to the forecast marker, e.g. "Forecast". */
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
 * as text (the loudest thing in the block), and a marker at the forecast
 * point — 4 px wide, taller than the track, its label anchored to it. The
 * summary line is left-aligned meta text with its icon beside it: the same
 * "over" pattern the money cell uses. Trending over is amber (`watch`);
 * actually over is `over`. Never a red bar.
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
  const Glyph = t.icon;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        <div className={cx("relative flex-1", clampedForecast !== undefined && forecastLabel && "mb-6")}>
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
                className={cx("absolute top-1/2 w-px -translate-y-1/2 bg-ink", stop === 50 ? "h-4" : "h-1.5")}
                style={{ left: `${stop}%` }}
              />
            ))}
            {clampedForecast !== undefined ? (
              <div
                className={cx("absolute w-1 -translate-x-1/2 rounded-full", t.marker)}
                style={{ left: `${clampedForecast}%`, top: "-4px", bottom: "-4px" }}
              >
                {forecastLabel ? (
                  // Anchored to the marker: it hangs off the marker's own box, right-aligned to it
                  // near the end of the track and centred under it elsewhere.
                  <span
                    className={cx(
                      "absolute top-full mt-1 whitespace-nowrap text-meta",
                      t.text,
                      clampedForecast >= 70 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    {forecastLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-figure num text-ink">{clamped}% done</span>
      </div>
      {note ? (
        <p className={cx("flex items-start gap-2 text-left text-meta", t.text)}>
          <Glyph size={24} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{keepAmountsTogether(note)}</span>
        </p>
      ) : null}
    </div>
  );
}
