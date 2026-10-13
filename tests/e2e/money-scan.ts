import { expect, type Page } from "@playwright/test";

// A dollar figure in what a person reads: whole ($775, $1,200) or with cents.
const MONEY_TEXT = /\$\s?\d/;
// The RSC payload has references like "$1" and "$undefined", so raw HTML is scanned for formatted amounts ($775.00).
const MONEY_AMOUNT = /\$\d[\d,]*\.\d{2}\b/;
// Any quoted key with a money word in it. Strict on purpose: a harmless future key such as "totalJobs" fails too, and can be renamed.
const MONEY_KEY = /"[^"]*(?:rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst)[^"]*"\s*:/i;
// Next writes the request's own query into the RSC tree as the page segment key (`__PAGE__?{"amount":"1482.00",…}`).
// That is the URL echoed back, not workspace data, so it is cut before the key scan; nothing else is.
const PAGE_QUERY_ECHO = /__PAGE__\?\{[^}]*\}/g;

/**
 * The foreman HTML money scan: for each path, the raw HTML (page and data) has no formatted amount or money key,
 * and what a person reads has no dollar figure. Sign in as the foreman first.
 */
export async function expectNoMoney(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    const raw = await (await page.request.get(path)).text();
    const html = path.includes("?") ? raw.replace(PAGE_QUERY_ECHO, "__PAGE__") : raw;
    expect(html, `${path} amount`).not.toMatch(MONEY_AMOUNT);
    expect(html.match(MONEY_KEY)?.[0] ?? null, `${path} money key`).toBeNull();
    await page.goto(path);
    expect(await page.locator("body").innerText(), `${path} visible text`).not.toMatch(MONEY_TEXT);
  }
}
