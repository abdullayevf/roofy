/** Test helpers: fake services over the shared seed (or a given store) at the default fake clock. */
import type { Actor, DataServices, DemoState, Role } from "../../contracts";
import { DEFAULT_FAKE_NOW } from "../clock";
import { emptyStore, sharedStore, type FakeStore } from "../store";
import { actorFor } from "./context";
import { createFakeServices } from "./index";

export const TEST_NOW = new Date(DEFAULT_FAKE_NOW);

export function fake(
  role: Role = "manager",
  options: { demo?: DemoState | null; store?: FakeStore; now?: Date } = {},
): { data: DataServices; actor: Actor; store: FakeStore } {
  const demo = options.demo ?? null;
  const store = options.store ?? (demo === "empty" ? emptyStore() : sharedStore());
  const now = options.now ?? TEST_NOW;
  return {
    data: createFakeServices(store, { now: () => now, demo }),
    actor: actorFor(store.tables, role),
    store,
  };
}
