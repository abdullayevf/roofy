/** Test helpers: fake services over the shared seed (or a given store) at the default fake clock. */
import type { Actor, DataServices, DemoState, Role } from "../../contracts";
import { DEFAULT_FAKE_NOW } from "../clock";
import { emptyStore, FakeStore, getSeed, sharedStore } from "../store";
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

/**
 * Fake services over a fresh writable copy of the seed (a demo session's store). `as(role)` gives
 * another role's services on the same store, e.g. to read back what a foreman just wrote.
 */
export function fakeSession(role: Role = "manager", options: { now?: Date; demo?: DemoState | null } = {}) {
  const store = new FakeStore(structuredClone(getSeed()), { readOnly: false });
  const as = (r: Role) => fake(r, { ...options, store });
  return { ...as(role), as };
}
