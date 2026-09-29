/**
 * The fake push endpoint under the real Next server (plan Task 7): a crew-day applies into the
 * browser's own demo session, and the same mutation id sent again returns the stored result.
 */
import { expect, test } from "@playwright/test";
import { v7 as uuidv7 } from "uuid";
import { getSeed } from "../../src/data/fake/store";

const { meta } = getSeed();

test("POST /api/sync/push applies once and replays the stored result", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "HTTP only: one browser project is enough");
  const mutation = {
    id: uuidv7(),
    type: "crew_day",
    schemaVersion: 1,
    appVersion: "0.1.0",
    createdAt: new Date().toISOString(),
    payload: {
      date: "2026-09-28",
      projectId: meta.projects.smith,
      stageId: meta.stages.smithSheetInstall,
      entries: [{ crewMemberId: meta.crew.jake, basis: "hourly", days: null, hours: 800, multiplier: null }],
    },
  };
  const first = await request.post("/api/sync/push", { data: { mutations: [mutation] } });
  expect(first.status()).toBe(200);
  expect(first.headers()["set-cookie"]).toMatch(/roofy_demo=[0-9a-f-]{36}/);
  const body = await first.json();
  expect(body.results[0]).toMatchObject({ id: mutation.id, status: "applied", result: { flags: [] } });

  const again = await request.post("/api/sync/push", { data: { mutations: [mutation] } });
  expect(again.headers()["set-cookie"]).toBeUndefined();
  expect(await again.json()).toEqual(body);

  const tooMany = await request.post("/api/sync/push", {
    data: { mutations: Array.from({ length: 26 }, () => ({ ...mutation, id: uuidv7() })) },
  });
  expect(tooMany.status()).toBe(400);
  expect((await tooMany.json()).error.message).toBe("Send at most 25 entries at a time.");
});
