import { expect, type Page } from "@playwright/test";

// A dollar figure in what a person reads: whole ($775, $1,200) or with cents.
const MONEY_TEXT = /\$\s?\d/;
// The RSC payload has references like "$1" and "$undefined", so raw HTML is scanned for formatted amounts ($775.00).
const MONEY_AMOUNT = /\$\d[\d,]*\.\d{2}\b/;
// Any quoted key with a money word in it. Strict on purpose: a harmless future key such as "totalJobs" fails too, and can be renamed.
const MONEY_KEY = /"[^"]*(?:rate|amount|cents|budget|margin|balance|cost|earn|pay|total|gst)[^"]*"\s*:/i;
// Next writes the request's own query into the RSC tree as the page segment key (`__PAGE__?{"amount":"1482.00",…}`,
// node_modules/next/dist/shared/lib/segment.js addSearchParamsIfPageSegment). That is the URL echoed back, not workspace
// data, so exactly that string, built from this request's path, is cut before both raw scans. Any other `__PAGE__?{…}`
// stays in and is scanned. Self-test: money-scan.spec.ts.

/** Next's page segment key for this path's query (`null` when it has none): `__PAGE__?` + JSON, a repeated key as an array. */
export function pageQueryEcho(path: string): string | null {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of new URL(path, "http://echo.invalid").searchParams) {
    const prev = query[key];
    query[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return Object.keys(query).length ? `__PAGE__?${JSON.stringify(query)}` : null;
}

/** Inside a JSON string (the RSC payload's own strings). */
const inJson = (s: string) => JSON.stringify(s).slice(1, -1);
/** Inside the HTML's `self.__next_f.push([1,"…"])`: the payload is a JSON string again, with `&`, `<`, `>` escaped. */
const inHtml = (s: string) => inJson(s).replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

/** The raw half of the scan: every formatted amount and money key in `raw` once this path's own query echo is cut. */
export function moneyFindings(raw: string, path: string): string[] {
  const echo = pageQueryEcho(path);
  let html = raw;
  if (echo) for (const form of [inHtml(inJson(echo)), inJson(echo), echo]) html = html.replaceAll(form, "__PAGE__");
  const findings: string[] = [];
  for (const m of html.matchAll(new RegExp(MONEY_AMOUNT, "g"))) findings.push(`${path} amount: ${m[0]}`);
  for (const m of html.matchAll(new RegExp(MONEY_KEY, "gi"))) findings.push(`${path} money key: ${m[0]}`);
  return findings;
}

/**
 * The foreman HTML money scan: for each path, the raw HTML (page and data) has no formatted amount or money key,
 * and what a person reads has no dollar figure. Sign in as the foreman first.
 */
export async function expectNoMoney(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    const raw = await (await page.request.get(path)).text();
    expect(moneyFindings(raw, path).slice(0, 5), `${path} raw HTML`).toEqual([]);
    await page.goto(path);
    expect(await page.locator("body").innerText(), `${path} visible text`).not.toMatch(MONEY_TEXT);
  }
}
