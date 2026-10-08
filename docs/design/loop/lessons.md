# Design-loop lessons (repeat findings; check your screens against every line before DONE)

- One plain sentence per alert or banner; no dash chains.
- Hints name only what is missing ("Add a start date"), never restate the form.
- Figures right-aligned in a fixed right column; tabular numerals; key figure is the one figure-xl.
- Job and stage names use non-breaking hyphens; long names wrap, never truncate the figure.
- Skeletons are shaped like the real content (same rows, same heights).
- One field-label style across a form.
- Phone landscape (height < 500 px): pinned action bar is one compact row; content scrolls above it.
- Error state: "Try again" is the primary button.
- Ticked or selected chip text uses ink colour (contrast passes axe in both themes).
- Unreadable money input never saves as $0.00; refuse with a hint instead.
- Back row is a 48 px target on phone.
- Foreman variants show dates, names, reasons and counts only: no $ anywhere, including aria labels and empty states.
- Unreadable or empty share/percent boxes never count as 0%; block Confirm with a hint (same rule as money).
- Working lines that explain a figure show percents to two places when not whole (30.49%, not 30%), so the line adds up by hand.
- Date inputs read dd/mm/yyyy on every browser and in every capture (en-AU locale), not just iPhone.
- Measure or capture a sheet or page only after it has settled (expectStill in guards.ts); on desktop, scope locators to the visible layout, since phone rows stay in the DOM hidden.
