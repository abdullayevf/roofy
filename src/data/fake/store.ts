/**
 * The fake layer's in-memory store (plan Task 6).
 *
 * - `sharedStore()` — the deterministic seed, built once per process and deep-frozen: every request
 *   without a demo-session cookie reads it, nobody writes to it.
 * - `sessionStore(id)` — one private copy per demo session (cookie `roofy_demo`), made with one
 *   `structuredClone` of the seed the first time the id is seen and kept in a bounded LRU (50).
 *   Writes (Task 7) go here and are logged in `mutations`.
 * - `emptyStore()` — `?demo=empty`: a new workspace with nothing but its settings (members, levels,
 *   categories, templates); every list is empty. Frozen and shared.
 *
 * Derived lookups (`indexes()`) are rebuilt lazily after a write (`version` changes).
 */
import type { Id, Instant } from "../contracts";
import { StoreIndex } from "./indexes";
import { buildSeed, type Seed } from "./seed";

export const SESSION_STORE_LIMIT = 50;

/** One applied field entry or admin write (Task 7 fills this). */
export interface StoreMutation {
  id: Id;
  type: string;
  actorUserId: Id;
  at: Instant;
  result: unknown;
}

export class FakeStore {
  readonly tables: Seed;
  readonly readOnly: boolean;
  readonly mutations: StoreMutation[] = [];
  private currentVersion = 0;
  private indexCache: { version: number; index: StoreIndex } | null = null;

  constructor(tables: Seed, options: { readOnly: boolean }) {
    this.tables = tables;
    this.readOnly = options.readOnly;
  }

  /** Bumped by every write; derived caches key on it. */
  get version(): number {
    return this.currentVersion;
  }

  /** Lookups over the current tables (built on first use, rebuilt after a write). */
  indexes(): StoreIndex {
    if (this.indexCache?.version !== this.currentVersion) {
      this.indexCache = { version: this.currentVersion, index: new StoreIndex(this.tables) };
    }
    return this.indexCache.index;
  }

  /** Runs a change against the tables. Read-only stores (shared seed, empty) refuse. */
  write<T>(change: (tables: Seed) => T): T {
    if (this.readOnly) throw new Error("This fake store is read-only: writes need a demo session.");
    const result = change(this.tables);
    this.currentVersion += 1;
    return result;
  }
}

// ─── Seed and shared stores ─────────────────────────────────────────────────

interface Stores {
  seed: Seed | null;
  shared: FakeStore | null;
  empty: FakeStore | null;
  sessions: Map<string, FakeStore>;
}

// Kept on globalThis so `next dev` module reloads don't drop every demo session.
const KEY = Symbol.for("roofy.fakeStores");
const g = globalThis as typeof globalThis & { [KEY]?: Stores };
const stores: Stores = (g[KEY] ??= { seed: null, shared: null, empty: null, sessions: new Map() });

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** The seed, built once per process (~100 ms) and frozen. */
export function getSeed(): Seed {
  return (stores.seed ??= deepFreeze(buildSeed()));
}

export function sharedStore(): FakeStore {
  return (stores.shared ??= new FakeStore(getSeed(), { readOnly: true }));
}

/** A new workspace: the seed's workspace and settings only; every list empty. */
export function buildEmptyTables(seed: Seed): Seed {
  return {
    workspace: seed.workspace,
    members: seed.members,
    projectAssignments: [],
    clients: [],
    projects: [],
    stageTemplates: seed.stageTemplates,
    stageTemplateItems: seed.stageTemplateItems,
    stages: [],
    stageSegments: [],
    stageCompletionShares: [],
    crewLevels: seed.crewLevels,
    crewMembers: [],
    rates: [],
    progressEntries: [],
    progressShares: [],
    workLogs: [],
    noWork: [],
    expenseCategories: seed.expenseCategories,
    expenses: [],
    payRuns: [],
    payRunLines: [],
    ledgerEntries: [],
    statementLinks: [],
    files: [],
    clientMutations: [],
    auditEvents: [],
    meta: { ...seed.meta, statementTokens: [], scenarios: [] },
  };
}

export function emptyStore(): FakeStore {
  return (stores.empty ??= new FakeStore(deepFreeze(buildEmptyTables(getSeed())), { readOnly: true }));
}

/**
 * The demo session's own store: created from the seed on first sight of `id`, then reused. Least
 * recently used sessions are dropped past `SESSION_STORE_LIMIT`.
 */
export function sessionStore(id: string): FakeStore {
  const hit = stores.sessions.get(id);
  if (hit) {
    stores.sessions.delete(id);
    stores.sessions.set(id, hit);
    return hit;
  }
  const created = new FakeStore(structuredClone(getSeed()), { readOnly: false });
  stores.sessions.set(id, created);
  while (stores.sessions.size > SESSION_STORE_LIMIT) {
    stores.sessions.delete(stores.sessions.keys().next().value!);
  }
  return created;
}

/** Test and diagnostics helpers. */
export function sessionStoreIds(): string[] {
  return [...stores.sessions.keys()];
}

export function clearSessionStores(): void {
  stores.sessions.clear();
}
