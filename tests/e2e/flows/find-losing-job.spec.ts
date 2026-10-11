// Flow: Find the job losing money and why (flows.md 194–207): from Home's Needs attention, open the stage trending over
// and then the lines behind its forecast labour, in at most 3 taps.
import { expect, test } from "@playwright/test";
import { getSeed } from "../../../src/data/fake/store";
import { Taps } from "../taps";

const { meta } = getSeed();

test("from Home, a manager finds the Smith job trending over and the lines behind it within 3 taps", async ({
  page,
}) => {
  await page.goto(`/prototype/role?as=manager&next=${encodeURIComponent("/")}`);
  const taps = new Taps("Find the job losing money");
  const row = page.getByRole("link", {
    name: /^Smith job is trending\s\S+\sover\sbudget\son\ssheet\sinstall\.$/,
  });
  await expect(row).toHaveCount(1);
  await taps.tap(row);
  await expect(page).toHaveURL(new RegExp(`/jobs/${meta.projects.smith}/stages/[^/?]+$`));
  await expect(page.getByText("Forecast labour")).toBeVisible();
  await taps.tap(page.getByRole("link", { name: /^Forecast labour/ }));
  await expect(page).toHaveURL(new RegExp(`/history\\?job=${meta.projects.smith}$`));
  taps.assertWithin(3);

  // What tap 2 shows (flows.md 202): the log lines behind the figure, and only this job's. The seed's Smith job has two
  // log lines in its record history (flows.md names Sam and Dima; the seed's are Ben's and Jake's).
  await expect(page.locator("[data-history-showing]")).toContainText(/^Showing Smith job/);
  const whats = (await page.locator("[data-history-what]:visible").allInnerTexts()).map((t) =>
    t.replace(/\u00a0/g, " ").trim(),
  );
  // A log line is either a log added ("Added Ben's log for Mon 14 Sep") or a pay adjustment added to one ("Added a $12.00 pay
  // adjustment to Jake's log for Thu 17 Sep"); both name the person and end with the day the log was for.
  const LOG_LINE = /^Added (?:a \$[\d,]+\.\d{2} pay adjustment to )?(\S+)'s log for (\w{3} \d{1,2} \w{3})$/;
  const logLines = whats.filter((w) => LOG_LINE.test(w));
  // 1: exactly two log lines, one per person, each with the day it was for.
  expect(logLines, "the two log lines behind the forecast").toHaveLength(2);
  expect(logLines.map((w) => w.match(LOG_LINE)?.[1]).sort()).toEqual(["Ben", "Jake"]);
  expect(logLines.map((w) => w.match(LOG_LINE)?.[2]).sort()).toEqual(["Mon 14 Sep", "Thu 17 Sep"]);
  // 2: nothing from another job sits beside them, and the job column is dropped because it is all one job.
  expect(
    whats.filter((w) => !logLines.includes(w)),
    "the rest is this job's expense",
  ).toEqual([expect.stringMatching(/receipt$/)]);
  await expect(page.locator("[data-history-job]:visible")).toHaveCount(0);
});
