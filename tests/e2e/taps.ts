/**
 * Tap-budget helper (flows.md "How taps are counted"; Task 20 builds the flow suite on it).
 *
 * `const taps = new Taps("Same as yesterday");` then `await taps.tap(locator)` for every control a person
 * would press (buttons, chips, rows, tabs, toggles, and a field tapped to focus it). Typing does not count,
 * so use `fill()` on the locator directly. `taps.assertWithin(3)` fails when the flow used more taps than
 * its budget in flows.md. The timing check (< 30 s with 500 ms think time per tap) is Task 20's.
 */
import type { Locator } from "@playwright/test";

export class Taps {
  private taken = 0;
  private readonly log: string[] = [];

  constructor(readonly flow: string) {}

  /** Taps counted so far. */
  get count(): number {
    return this.taken;
  }

  /** Clicks the control and counts one tap. */
  async tap(target: Locator): Promise<void> {
    await target.click();
    this.taken += 1;
    this.log.push(String(target));
  }

  /** Chooses an option in a list field (`<select>`): one tap, like the native picker it opens. */
  async choose(target: Locator, value: string): Promise<void> {
    await target.selectOption(value);
    this.taken += 1;
    this.log.push(`${String(target)} -> ${value}`);
  }

  /** Fails, naming every tap, when the flow used more than `budget` taps. */
  assertWithin(budget: number): void {
    if (this.taken <= budget) return;
    const steps = this.log.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
    throw new Error(`"${this.flow}" took ${this.taken} taps; the budget is ${budget}.\n${steps}`);
  }
}
