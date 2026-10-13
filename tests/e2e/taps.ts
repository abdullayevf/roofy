/**
 * Tap-budget helper (flows.md "How taps are counted"; every spec in `tests/e2e/flows/` is built on it).
 *
 * `const taps = new Taps("Same as yesterday");` then `await taps.tap(locator)` for every control a person
 * would press (buttons, chips, rows, tabs, toggles, and a field tapped to focus it). Typing does not count,
 * so use `fill()` on the locator directly. `taps.assertWithin(3)` fails when the flow used more taps than
 * its budget in flows.md.
 *
 * Timing: `new Taps("Log a full crew-day", { thinkMs: 500 })` waits that long before every tap, standing in
 * for a person finding and pressing the control, and `taps.assertWithin(6, { maxMs: 30_000 })` also fails when
 * the scripted wall time (think time included) from construction to the check goes over the limit. Only the
 * crew-day (< 30 s) and onboarding (< 10 min) flows use it (flows.md); the other flows are tap-counted only.
 */
import { test, type Locator } from "@playwright/test";

export interface TapsOptions {
  /** Pause before each tap, in milliseconds, in place of the time a person takes. Default 0. */
  thinkMs?: number;
}

export interface TapLimits {
  /** Longest scripted wall time, in milliseconds, from creating the counter to the check. */
  maxMs?: number;
}

export class Taps {
  private taken = 0;
  private readonly log: string[] = [];
  private readonly startedAt = performance.now();
  private readonly thinkMs: number;

  constructor(
    readonly flow: string,
    options: TapsOptions = {},
  ) {
    this.thinkMs = options.thinkMs ?? 0;
  }

  /** Taps counted so far. */
  get count(): number {
    return this.taken;
  }

  /** Scripted wall time so far, think time included. */
  get elapsedMs(): number {
    return performance.now() - this.startedAt;
  }

  /** Clicks the control and counts one tap. */
  async tap(target: Locator): Promise<void> {
    await this.think();
    await target.click();
    this.taken += 1;
    this.log.push(String(target));
  }

  /** Taps a text field to focus it (one tap), then types into it (typing is not counted). */
  async fill(target: Locator, text: string): Promise<void> {
    await this.tap(target);
    await target.fill(text);
  }

  /** Chooses an option in a list field (`<select>`): one tap, like the native picker it opens. */
  async choose(target: Locator, value: string): Promise<void> {
    await this.think();
    await target.selectOption(value);
    this.taken += 1;
    this.log.push(`${String(target)} -> ${value}`);
  }

  /**
   * Fails, naming every tap, when the flow used more than `budget` taps, or (with `maxMs`) took longer than
   * that. A pass records "N of budget taps" on the test so a run shows how close each flow is.
   */
  assertWithin(budget: number, limits: TapLimits = {}): void {
    const steps = this.log.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
    if (this.taken > budget) {
      throw new Error(`"${this.flow}" took ${this.taken} taps; the budget is ${budget}.\n${steps}`);
    }
    const elapsed = Math.round(this.elapsedMs);
    if (limits.maxMs !== undefined && elapsed > limits.maxMs) {
      throw new Error(
        `"${this.flow}" took ${elapsed} ms (with ${this.thinkMs} ms think time per tap); the limit is ${limits.maxMs} ms.\n${steps}`,
      );
    }
    test.info().annotations.push({ type: "taps", description: `${this.flow}: ${this.taken} of ${budget} taps, ${elapsed} ms` });
  }

  private async think(): Promise<void> {
    if (this.thinkMs > 0) await new Promise((resolve) => setTimeout(resolve, this.thinkMs));
  }
}
