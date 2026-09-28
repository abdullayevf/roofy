# Roofy — Reference atlas (D2/§4)

Used for quality bar, not for copying — general knowledge of how these products handle a job, not their assets. For each benchmark, both critic agents (`.claude/agents/design-critic.md`, `.claude/agents/field-critic.md`) ask: **"is ours at least this clear/fast/precise for the equivalent job?"** and cite the specific check below when they mark a screen down.

---

## Wise — clarity of money, amounts and statuses

1. The amount is always the biggest, boldest thing on its row or card — never sharing visual weight with a label, icon or status pill next to it.
2. A negative amount reads as a minus sign and colour together, never colour alone, and the minus is a true minus (`−`), not a hyphen.
3. A status (pending, converted, failed) is a short plain word or two, never an icon by itself and never a jargon state name.
4. Currency and units are never ambiguous — no bare numbers where a reader could mistake m² for a count, or a rate for a total.
5. Every amount that came from somewhere (a transfer, a conversion) is one tap from the detail behind it — nothing is a dead-end number.
6. Historical/settled amounts are visually calmer (lighter weight or muted colour) than live/pending ones, so the eye finds "what still needs me" first.

**Applies to:** money cells, the tape bar's dollar figures, pay run lines, ledger balances, needs-attention amounts.

## Linear — typographic precision, restraint, desktop density

1. Exactly one weight/size does one job — a heading is never almost-a-body-size, a label never almost-a-heading-size. No in-between sizes invented mid-screen.
2. Alignment is exact: numbers in a column share a right edge to the pixel; icons in a row share a baseline.
3. Desktop uses the extra width for more information (a second column, a wider table), never for larger white space around the same content.
4. Nothing repeats a word the surrounding UI already established (no "Job: Smith job" when the column header already says "Job").
5. Hover/focus states are a single, consistent treatment across the whole app (background shift or outline), never a different affordance per component.
6. Density is a deliberate choice per breakpoint (48px desktop rows vs 64px phone rows, DESIGN.md §5) — never the same row height stretched or squeezed inconsistently.

**Applies to:** `/design`, Job/Crew/Pay run desktop tables, Reports, Settings forms.

## Apple Human Interface Guidelines — touch targets, sheets, tab bars, safe areas, Dynamic Type

1. Every tappable control is at least 44×44pt (Roofy's own bar is 48×48 CSS px, DESIGN.md §8 — stricter, so this is a floor, not the target).
2. A sheet's primary action is reachable without scrolling past the keyboard — it stays pinned, visible, above the home indicator.
3. Nothing sits under the notch or the home-indicator safe areas in standalone/installed mode, at any orientation.
4. The active tab in the bottom tab bar is unambiguous (fill icon + position), and the bar itself never scrolls or hides content behind it.
5. Text reflows, not truncates unreadably, when the system text size is turned up — a label that clips to "..." at larger sizes is a fail.
6. A destructive or consequential action (approve, pause, discard) always confirms in a sheet before it commits — never a single silent tap.

**Applies to:** all phone screens, every bottom sheet, the tab bar, installed-mode captures, 200% text-zoom checks.

## Material 3 — Android touch and navigation expectations

1. Touch targets and the spacing between them read comfortably on a taller, denser Android viewport (412×915) — nothing feels more cramped there than on iPhone at the same information density.
2. State changes (a tapped chip, a checked box) give an immediate, visible response — a fill, an outline change — never just a colour tint too subtle to register in daylight.
3. Back/forward navigation behaves predictably: a sheet or detail screen has one obvious way back, never two competing affordances (a close icon AND a browser-style back arrow) that disagree.
4. Form fields show their keyboard type correctly (decimal for m², numeric for hours, tel for phone) — Android users notice a wrong keyboard immediately.
5. Elevation/emphasis differences between a resting row and an active one are visible without colour alone (a raised look, a border), consistent with Roofy's own no-shadow-on-level-1 rule.

**Applies to:** the android viewport captures specifically — flag anything that reads fine on iPhone but cramped, ambiguous, or slow-to-respond on Android.

## Things 3 — calm lists, one primary action, quick entry

1. A list screen has exactly one obvious way to add the next item, always in the same place, never buried in a menu.
2. Rows are calm: one primary line, one secondary line, nothing competing for attention — no screen has more than one "loud" (bold/large/coloured) element per row.
3. Completing/logging something gives a small, satisfying, immediate confirmation (Roofy's "Logged" motion, DESIGN.md §9) and then gets out of the way — no lingering banner, no extra tap to dismiss.
4. Quick entry defaults sensibly (today's date, the last-used project) so the common case takes the fewest taps, with the full/custom path still one tap away.
5. Empty states are a single calm sentence plus the one action that fixes it — never a graphic, never multiple competing suggestions.
6. Nothing on a list screen requires reading more than the first line to know whether it needs attention.

**Applies to:** Jobs list, Crew list, Expenses list, Pay runs list, Outbox, the crew-day grid's row pattern.
