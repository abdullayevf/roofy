import { WarningCircle, WarningDiamond } from "@phosphor-icons/react/dist/ssr";
import { cx } from "@/lib/cx";
import { KeepTogether } from "@/components/keep-together";

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
  /** The forecast marker's own tone when it differs from the note's (defaults to `tone`). */
  markerTone?: TapeBarTone;
  /**
   * The plain-language summary, e.g. "$775.00 over — forecast $4,775.00 of
   * $4,000.00". Manager only: a foreman-facing TapeBar is given no forecast,
   * label or note at all rather than a money-free version of them.
   */
  note?: string;
  /** The caption beside the %: "done" by default, "Whole job" on a job card. Same slot either way. */
  scope?: string;
  className?: string;
};

const TICK_STOPS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

const TONE = {
  watch: { marker: "bg-watch", text: "text-watch", icon: WarningDiamond },
  over: { marker: "bg-over", text: "text-over", icon: WarningCircle },
} as const;

/** How far past the end cap the marker can sit, in px. The 28 px gap before the % slot leaves at least 12 px clear of the marker. */
const MAX_OVERRUN_PX = 14;
/** A forecast this many points past 100% (or more) sits at the full extension; the exact figure is in the note. */
const OVERRUN_FULL_AT = 20;

export type MarkerPosition = {
  /** Where the marker sits along the 0-100% track, as a whole percent. Never past 100. */
  percent: number;
  /** How far past the end cap it sits, in px (0 while the forecast is within the track). */
  overrunPx: number;
};

/**
 * DESIGN.md §4: the marker sits at the forecast point. Within 100% that is a
 * point on the track; past 100% (a forecast that lands over budget) it can't
 * be drawn on the track, so it sits just beyond the end cap, joined to it by
 * a short bar in the marker's colour — further out the bigger the overrun,
 * up to a fixed maximum so every track stays the same length.
 */
export function markerPosition(forecastPercent: number): MarkerPosition {
  const forecast = Math.max(0, forecastPercent);
  if (forecast <= 100) return { percent: forecast, overrunPx: 0 };
  const over = Math.min(forecast - 100, OVERRUN_FULL_AT);
  return { percent: 100, overrunPx: Math.round((over / OVERRUN_FULL_AT) * MAX_OVERRUN_PX * 10) / 10 };
}

/**
 * DESIGN.md §4 tape bar: 12 px steel-tape track (surface, 1 px ink outline),
 * tape fill, ink ticks every 10% (the 50% tick clearly taller), and the %
 * printed as text in a fixed-width slot so every track is the same length.
 * A marker sits at the forecast point (see `markerPosition`); its caption is
 * its own row under the track, never inside the marker. The summary line is
 * left-aligned meta text with its icon beside it: the same "over" pattern
 * the money cell uses. Trending over is amber (`watch`); actually over is
 * `over`. Never a red bar.
 */
export function TapeBar({
  label,
  percent,
  forecastPercent,
  forecastLabel,
  tone = "watch",
  markerTone = tone,
  note,
  scope = "done",
  className,
}: TapeBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const marker = forecastPercent === undefined ? undefined : markerPosition(forecastPercent);
  const t = TONE[tone];
  const m = TONE[markerTone];
  const Glyph = t.icon;
  // The caption sits centred under its marker (left-aligned only when the marker is at the very start of the track).
  const captionAtStart = marker !== undefined && marker.percent < 12;

  return (
    <div className={cx("grid grid-cols-[minmax(0,1fr)_min(8.5rem,45%)] items-center gap-x-[min(1.75rem,8vw)] gap-y-1", className)}>
      <div className="relative h-3">
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${clamped}% done`}
          className="relative h-full overflow-visible rounded-full border border-ink bg-surface"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-tape" style={{ width: `${clamped}%` }} />
          {TICK_STOPS.map((stop) => (
            <span
              key={stop}
              aria-hidden="true"
              className={cx("absolute top-1/2 w-px -translate-y-1/2 bg-ink", stop === 50 ? "h-4" : "h-1.5")}
              style={{ left: `${stop}%` }}
            />
          ))}
          {marker ? (
            <>
              {marker.overrunPx > 0 ? (
                <span
                  aria-hidden="true"
                  data-testid="tape-overrun"
                  className={cx("absolute top-1/2 h-1 -translate-y-1/2", m.marker)}
                  style={{ left: "100%", width: `${marker.overrunPx}px` }}
                />
              ) : null}
              <span
                aria-hidden="true"
                data-testid="tape-marker"
                className={cx("absolute w-1 -translate-x-1/2 rounded-full", m.marker)}
                style={{
                  left: marker.overrunPx > 0 ? `calc(100% + ${marker.overrunPx}px)` : `${marker.percent}%`,
                  top: "-4px",
                  bottom: "-4px",
                }}
              />
            </>
          ) : null}
        </div>
      </div>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="whitespace-nowrap text-figure num text-ink">{clamped}%</span>
        <span className="whitespace-nowrap text-body text-ink-2">{scope}</span>
      </span>
      {marker && forecastLabel ? (
        <div className="relative h-6">
          <span
            className={cx("absolute top-0 whitespace-nowrap text-body", m.text)}
            style={{
              left: marker.overrunPx > 0 ? `calc(100% + ${marker.overrunPx}px)` : `${marker.percent}%`,
              transform: captionAtStart ? "translateX(-2px)" : "translateX(-50%)",
            }}
          >
            {forecastLabel}
          </span>
        </div>
      ) : null}
      {note ? (
        <p className={cx("col-span-2 flex items-start gap-2 text-left text-body-strong", t.text)}>
          <Glyph size={24} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0">
            <KeepTogether text={note} />
          </span>
        </p>
      ) : null}
    </div>
  );
}
