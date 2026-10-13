// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ExpenseCategory } from "@/data/contracts";
import { AssignmentsForm, CategoriesForm } from "./settings-lists";

const refresh = vi.fn();
const saveCategory = vi.fn();
const setAssignments = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/actions/settings", () => ({
  inviteMember: async () => ({ ok: true }),
  saveCategory: (...args: unknown[]) => saveCategory(...args),
  saveTemplate: async () => ({ ok: true }),
  setAssignments: (...args: unknown[]) => setAssignments(...args),
  setMemberRole: async () => ({ ok: true }),
}));

const CATEGORIES = [
  { id: "c1", name: "Fuel", position: 1 },
  { id: "c2", name: "Tools", position: 2 },
] as unknown as ExpenseCategory[];

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
  saveCategory.mockReset();
  saveCategory.mockResolvedValue({ ok: false, message: "Couldn't save. Try again.", issues: [] });
  setAssignments.mockReset();
});

describe("CategoriesForm sheet (review F3)", () => {
  it("a reopened sheet does not show the last failed save's sentence", async () => {
    const user = userEvent.setup();
    render(<CategoriesForm categories={CATEGORIES} demoOffline={false} />);
    await user.click(screen.getByRole("button", { name: /Fuel/ }));
    await user.clear(screen.getByLabelText("Category name"));
    await user.type(screen.getByLabelText("Category name"), "Diesel");
    await user.click(screen.getByRole("button", { name: "Save category" }));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Tools/ }));
    expect(screen.getByLabelText("Category name")).toHaveValue("Tools");
    expect(screen.queryByText("Couldn't save. Try again.")).toBeNull();
  });

  it("saving a rename with the same name closes the sheet without a Changes saved toast", async () => {
    const user = userEvent.setup();
    render(<CategoriesForm categories={CATEGORIES} demoOffline={false} />);
    await user.click(screen.getByRole("button", { name: /Fuel/ }));
    await user.click(screen.getByRole("button", { name: "Save category" }));
    expect(screen.queryByLabelText("Category name")).toBeNull();
    expect(screen.queryByText("Changes saved.")).toBeNull();
    expect(saveCategory).not.toHaveBeenCalled();
  });
});

describe("AssignmentsForm row-by-row save (review F4)", () => {
  it("refreshes the page when a later foreman fails after an earlier one saved", async () => {
    setAssignments.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, message: "Couldn't save. Try again.", issues: [] });
    const user = userEvent.setup();
    render(
      <AssignmentsForm
        foremen={[
          { memberId: "m1", name: "Dean Cole", projectIds: [] },
          { memberId: "m2", name: "Ali Khan", projectIds: [] },
        ]}
        jobs={[{ id: "j1", name: "12 Pitt St" }]}
        demoOffline={false}
      />,
    );
    for (const box of screen.getAllByRole("checkbox", { name: "12 Pitt St" })) await user.click(box);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(setAssignments).toHaveBeenCalledTimes(2);
    expect(refresh, "the first foreman's saved jobs reach the page's props").toHaveBeenCalled();
  });
});
