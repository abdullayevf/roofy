// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Member } from "@/data/contracts";
import { MembersForm } from "./settings-lists";

const refresh = vi.fn();
const setMemberRole = vi.fn();
const removeMember = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/settings", () => ({
  inviteMember: async () => ({ ok: true }),
  saveCategory: async () => ({ ok: true }),
  saveTemplate: async () => ({ ok: true }),
  setAssignments: async () => ({ ok: true }),
  setMemberRole: (...args: unknown[]) => setMemberRole(...args),
  removeMember: (...args: unknown[]) => removeMember(...args),
}));

const member = (id: string, name: string, role: Member["role"]): Member => ({
  id,
  userId: `u-${id}`,
  name,
  email: `${name.split(" ")[0]!.toLowerCase()}@harbourroofing.example`,
  role,
  twoFactorEnabled: false,
  projectIds: [],
});
const MEMBERS = [member("m1", "Karen Holt", "owner"), member("m2", "Priya Shah", "accountant"), member("m3", "Dean Cole", "foreman")];

// The sheet picks its desktop dialog (not the phone drawer, which needs drag APIs jsdom lacks) from matchMedia.
beforeEach(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1024px)",
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  refresh.mockClear();
  setMemberRole.mockReset();
  setMemberRole.mockResolvedValue({ ok: true });
  removeMember.mockReset();
  removeMember.mockResolvedValue({ ok: true });
});

describe("MembersForm: a person is a row, the role changes in a sheet", () => {
  it("shows each person's name, email and role as plain text, with no role dropdown in the list", () => {
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    const priya = screen.getByRole("button", { name: /Priya Shah/ });
    expect(priya).toHaveTextContent("priya@harbourroofing.example");
    expect(priya).toHaveTextContent("Accountant");
  });

  it("the Owner's row names the role but opens nothing", () => {
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    expect(screen.queryByRole("button", { name: /Karen Holt/ })).toBeNull();
    expect(screen.getByText("Karen Holt").closest("div")).toHaveTextContent("Owner");
  });

  it("tapping a row opens a sheet that saves the picked role and closes", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    await user.click(screen.getByRole("button", { name: /Priya Shah/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change role" });
    expect(within(sheet).getByRole("radio", { name: /Accountant/ })).toBeChecked();
    await user.click(within(sheet).getByRole("radio", { name: /Manager/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save role" }));
    expect(setMemberRole).toHaveBeenCalledWith("m2", "manager");
    expect(await screen.findByText("Role changed.")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /Priya Shah/ })).toHaveTextContent("Manager");
  });

  it("a role the server refuses stays as it was and the sheet says why", async () => {
    const user = userEvent.setup();
    setMemberRole.mockResolvedValue({ ok: false, code: "forbidden", message: "Only the Owner can change roles.", issues: [] });
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    await user.click(screen.getByRole("button", { name: /Dean Cole/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change role" });
    await user.click(within(sheet).getByRole("radio", { name: /Manager/ }));
    await user.click(within(sheet).getByRole("button", { name: "Save role" }));
    expect(await within(sheet).findByText("Only the Owner can change roles.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Dean Cole/, hidden: true })).toHaveTextContent("Foreman");
  });

  it("saving the role a person already has just closes the sheet", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    await user.click(screen.getByRole("button", { name: /Priya Shah/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change role" });
    await user.click(within(sheet).getByRole("button", { name: "Save role" }));
    expect(setMemberRole).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("MembersForm: removing a person asks first", () => {
  const openRemove = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
    await user.click(screen.getByRole("button", { name }));
    const sheet = await screen.findByRole("dialog", { name: "Change role" });
    await user.click(within(sheet).getByRole("button", { name: "Remove from team" }));
    return screen.findByRole("dialog", { name: /^Remove .+\?$/ });
  };

  it("Remove from team in the sheet opens a confirm that names the person and nothing is removed yet", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    const confirm = await openRemove(user, /Priya Shah/);
    expect(confirm).toHaveAccessibleName("Remove Priya Shah?");
    expect(confirm).toHaveTextContent("They lose their access to Roofy straight away.");
    expect(removeMember).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Priya Shah/, hidden: true })).toBeInTheDocument();
  });

  it("cancelling keeps the person and removes nothing", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    const confirm = await openRemove(user, /Priya Shah/);
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(removeMember).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Priya Shah/ })).toBeVisible();
  });

  it("confirming removes that member id, drops the row and says so", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    const confirm = await openRemove(user, /Priya Shah/);
    await user.click(within(confirm).getByRole("button", { name: "Remove from team" }));
    expect(removeMember).toHaveBeenCalledTimes(1);
    expect(removeMember).toHaveBeenCalledWith("m2");
    expect(await screen.findByText("Person removed.")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Priya Shah/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Dean Cole/ })).toBeVisible();
  });

  it("a removal the server refuses keeps the row and shows the sentence", async () => {
    const user = userEvent.setup();
    removeMember.mockResolvedValue({ ok: false, code: "conflict", message: "A workspace needs at least one Owner.", issues: [] });
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    const confirm = await openRemove(user, /Dean Cole/);
    await user.click(within(confirm).getByRole("button", { name: "Remove from team" }));
    expect(await screen.findByText("A workspace needs at least one Owner.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Dean Cole/ })).toBeVisible();
    expect(screen.queryByText("Person removed.")).toBeNull();
  });

  it("offline, the remove button is disabled and says it needs a connection", async () => {
    const user = userEvent.setup();
    render(<MembersForm members={MEMBERS} demoOffline />);
    await user.click(screen.getByRole("button", { name: /Priya Shah/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change role" });
    expect(within(sheet).getByRole("button", { name: "Remove from team" })).toBeDisabled();
  });

  it("the Owner's row has no way to remove", () => {
    render(<MembersForm members={MEMBERS} demoOffline={false} />);
    expect(screen.queryByRole("button", { name: /Karen Holt/ })).toBeNull();
  });
});
