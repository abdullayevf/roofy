/**
 * DESIGN.md §4: focus is a 3 px chalk ring outside the border, following the
 * control's own radius. In dark mode the ring uses `chalk-link` (the light
 * blue, >= 3:1 against dark galv/surface) rather than the `chalk` fill.
 * `chalk-link` equals `chalk` in light mode, so one class serves both.
 */
export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-chalk-link";

/** The same ring, always on — a static "Focus" sample for screenshots. */
export const FOCUS_RING_FORCED = "outline outline-[3px] outline-offset-2 outline-chalk-link";

/** For a wrapper whose (visually hidden) input takes the focus: ring the wrapper, so it follows the wrapper's radius. */
export const FOCUS_RING_WITHIN =
  "has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-chalk-link";

export function focusRing(forced?: boolean): string {
  return forced ? FOCUS_RING_FORCED : FOCUS_RING;
}

export function focusRingWithin(forced?: boolean): string {
  return forced ? FOCUS_RING_FORCED : FOCUS_RING_WITHIN;
}
