import { expect, test } from "@playwright/test";
import { moneyFindings, pageQueryEcho } from "./money-scan";

/**
 * Self-test for the foreman money scan's raw-HTML half (review F2): the cut removes only Next's echo of this request's
 * own query, so a real amount or money key anywhere else in the same response still fails. No server needed.
 */

/** HTML the way Next sends it: the RSC tree as a JSON string inside `self.__next_f.push`, `<`, `>`, `&` escaped. */
function nextHtml(pageKey: string, extra: Record<string, unknown> = {}, text = ""): string {
  const flight = `0:${JSON.stringify(["", { children: [pageKey, {}, { props: extra }] }])}`;
  const chunk = JSON.stringify(flight).replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  return `<html><body><main>${text}</main><script>self.__next_f.push([1,${chunk}])</script></body></html>`;
}

const path = "/expenses/new?amount=1482.00&who=Sam&tag=a&tag=b";
const echo = pageQueryEcho(path)!;

test.describe("money scan (raw HTML)", () => {
  test("the echo is Next's page key built from this request's query, repeated keys as an array", () => {
    expect(echo).toBe('__PAGE__?{"amount":"1482.00","who":"Sam","tag":["a","b"]}');
    expect(pageQueryEcho("/expenses/new")).toBeNull();
  });

  test("the request's own query echoed back is not a finding", () => {
    expect(moneyFindings(nextHtml(echo), path)).toEqual([]);
    // The plain RSC form (a client navigation) is cut too.
    expect(moneyFindings(`0:["",{"children":["${echo.replace(/"/g, '\\"')}",{}]}]`, path)).toEqual([]);
  });

  test("a money key elsewhere in a response that also echoes the query still fails", () => {
    const found = moneyFindings(nextHtml(echo, { rateCents: 7500 }), path);
    expect(found.join("\n")).toMatch(/money key: "rateCents\\*":/);
  });

  test("a formatted amount elsewhere in a response that also echoes the query still fails", () => {
    expect(moneyFindings(nextHtml(echo, {}, "Owed $775.00"), path).join("\n")).toMatch(/amount: \$775\.00/);
    expect(moneyFindings(nextHtml(echo, { label: "$1,482.00" }), path).join("\n")).toMatch(/amount: \$1,482\.00/);
  });

  test("a page key that is not this request's query is not cut", () => {
    const other = '__PAGE__?{"amount":"1482.00"}';
    expect(moneyFindings(nextHtml(other), "/expenses/new?who=Sam").join("\n")).toMatch(/money key/);
    expect(moneyFindings(nextHtml(other), "/expenses/new").join("\n")).toMatch(/money key/);
  });
});

test("Next's real echo is cut exactly: a foreman page opened with a money word in its query", async ({ page }) => {
  await page.goto("/prototype/role?as=foreman&next=%2F");
  const path = "/log?total=110.00&gst=10.00";
  const raw = await (await page.request.get(path)).text();
  expect(raw, "Next echoes the query as the page key").toContain("__PAGE__?");
  expect(raw, "the echo carries the money words").toMatch(/total/);
  expect(moneyFindings(raw, path)).toEqual([]);
});
