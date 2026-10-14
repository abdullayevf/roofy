// Task 11: the foreman scan. Every registered real service method runs as a foreman of a seeded
// workspace; what a foreman can reach must carry no money, and the rest must refuse forbidden.
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataError, type Actor } from "@/data/contracts";
import { expectNoMoney } from "@/data/dto";
import { WORKSPACE_SCAN, type ScanFixtures } from "@/server/services/foreman-scan";
import { createWorkspaceService } from "@/server/services/workspace";
import { closePools, pool, rows, seedWorkspace } from "./helpers";

let foreman: Actor;
let fx: ScanFixtures;

beforeAll(async () => {
  const owner = await seedWorkspace("Foreman Scan");
  const userId = uuidv7();
  const memberId = uuidv7();
  await pool("owner").query(`insert into "user" (id, name, email, two_factor_enabled) values ($1, 'Scan foreman', $2, true)`, [userId, `scan-${userId}@example.test`]);
  await pool("owner").query(`insert into member (id, workspace_id, user_id, role) values ($1, $2, $3, 'foreman')`, [memberId, owner.workspaceId, userId]);
  const [p] = await rows<{ id: string }>("owner", "select id from project where workspace_id = $1", [owner.workspaceId]);
  await pool("owner").query(`insert into project_assignment (id, workspace_id, member_id, project_id) values ($1, $2, $3, $4)`, [uuidv7(), owner.workspaceId, memberId, p!.id]);
  foreman = { userId, workspaceId: owner.workspaceId, role: "foreman", name: "Scan foreman" };
  fx = { foremanMemberId: memberId, projectId: p!.id };
});
afterAll(closePools);

describe("foreman scan: workspace", () => {
  const service = createWorkspaceService();
  for (const [method, entry] of Object.entries(WORKSPACE_SCAN)) {
    if ("reach" in entry) {
      it(`${method} carries no money for a foreman`, async () => {
        expectNoMoney(await entry.reach(service, foreman, fx), `workspace.${method}`);
      });
    } else {
      it(`${method} is refused to a foreman`, async () => {
        const e = await entry.refused(service, foreman, fx).then(() => expect.fail("expected forbidden"), (x: unknown) => x);
        expect(e).toBeInstanceOf(DataError);
        expect((e as DataError).code).toBe("forbidden");
      });
    }
  }
});
