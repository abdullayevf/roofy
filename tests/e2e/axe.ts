import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** Runs axe-core against the page, scoped to WCAG 2.0/2.1 A and AA. */
export function runAxe(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}
