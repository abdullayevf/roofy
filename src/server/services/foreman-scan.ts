/**
 * The foreman scan registry (Task 11): every method of each real service a foreman can call, with
 * how the scan calls it. `reach` methods run as a foreman and their result must carry no money
 * (`expectNoMoney`); `refused` methods must reject `forbidden`. Typed as a full mapping so a new
 * method fails to compile until it is listed; `foreman-scan.test.ts` checks the same at run time.
 * Onboarding joins in Task 12 and later phases append their services.
 */
import type { Actor, WorkspaceService } from "@/data/contracts";

export type ScanFixtures = { foremanMemberId: string; projectId: string };
type Call<S> = (service: S, foreman: Actor, fx: ScanFixtures) => Promise<unknown>;
export type ScanEntry<S> = { reach: Call<S> } | { refused: Call<S> };
export type ScanRegistry<S> = { [K in keyof S]-?: ScanEntry<S> };

/** A placeholder input for a refused write: the role check runs before the input is read. */
const input = <K extends keyof WorkspaceService>() => ({}) as Parameters<WorkspaceService[K]>[1];

export const WORKSPACE_SCAN: ScanRegistry<WorkspaceService> = {
  settings: { reach: (s, f) => s.settings(f) },
  categories: { reach: (s, f) => s.categories(f) },
  turnOnTwoFactor: { reach: (s, f) => s.turnOnTwoFactor(f, "123456") },
  updateSettings: { refused: (s, f) => s.updateSettings(f, input<"updateSettings">()) },
  levels: { refused: (s, f) => s.levels(f) },
  saveLevel: { refused: (s, f) => s.saveLevel(f, input<"saveLevel">()) },
  saveCategory: { refused: (s, f) => s.saveCategory(f, input<"saveCategory">()) },
  templates: { refused: (s, f) => s.templates(f) },
  saveTemplate: { refused: (s, f) => s.saveTemplate(f, input<"saveTemplate">()) },
  members: { refused: (s, f) => s.members(f) },
  inviteMember: { refused: (s, f) => s.inviteMember(f, { email: "scan@example.test", name: "Scan", role: "foreman" }) },
  setMemberRole: { refused: (s, f, fx) => s.setMemberRole(f, fx.foremanMemberId, "manager") },
  assignments: { refused: (s, f) => s.assignments(f) },
  setAssignments: { refused: (s, f, fx) => s.setAssignments(f, fx.foremanMemberId, [fx.projectId]) },
};
