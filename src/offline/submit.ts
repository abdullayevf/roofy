/**
 * Client-side field-entry submit (Phase 2): builds the architecture §7 mutation envelope and POSTs it
 * to `/api/sync/push`, returning the per-mutation result.
 *
 * Phase 2 only: no retries and no durability — a `retry` answer is handed back, not queued, and
 * nothing is kept on the phone. Phase 5 replaces this module with the Dexie outbox (durable queue,
 * backoff, ordered batches, "N to send"), keeping the same envelope and response shape.
 *
 * ```ts
 * import { submit } from "@/offline/submit";
 * const r = await submit("crew_day", { date, projectId, stageId, entries });
 * if (r.status === "applied") showLogged(r.result.flags);   // e.g. ["auto_started"]
 * else if (r.status === "rejected") showNeedsAttention(r.message);
 * else showWaiting();                                       // "retry": no signal / server busy
 * ```
 */
import { v7 as uuidv7 } from "uuid";
import {
  MAX_PUSH_BATCH,
  type MutationEnvelope,
  type MutationPayloads,
  type MutationType,
  type PushResponse,
  type PushResult,
} from "@/data/contracts";
import { noteWaiting } from "./waiting";

/** Sent with every mutation (architecture §7: the server accepts the previous schema for a release). */
export const APP_VERSION = "0.1.0";
export const PUSH_URL = "/api/sync/push";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface SubmitOptions {
  /** Defaults to the global `fetch` (tests pass a mock). */
  fetch?: Fetch;
  /** Defaults to the current instant. */
  now?: Date;
}

/** One field entry as a mutation: a new UUIDv7 id (the idempotency key), schema 1, app version, time. */
export function buildEnvelope<T extends MutationType>(
  type: T,
  payload: MutationPayloads[T],
  options: { now?: Date } = {},
): MutationEnvelope {
  return {
    id: uuidv7(),
    type,
    schemaVersion: 1,
    appVersion: APP_VERSION,
    createdAt: (options.now ?? new Date()).toISOString(),
    payload,
  } as MutationEnvelope;
}

const retryAll = (envelopes: readonly MutationEnvelope[]): PushResult[] =>
  envelopes.map((e) => ({ id: e.id, status: "retry" }));

/**
 * Sends up to 25 envelopes in one request, in order, and returns one result per envelope (same order).
 * No signal or a server fault → `retry`; a refused request (400) → `rejected` with the server's message.
 */
export async function submitMany(
  envelopes: readonly MutationEnvelope[],
  options: SubmitOptions = {},
): Promise<PushResult[]> {
  if (envelopes.length > MAX_PUSH_BATCH) throw new RangeError(`at most ${MAX_PUSH_BATCH} mutations per push`);
  const fetchFn = options.fetch ?? ((url, init) => fetch(url, init));
  let response: Response;
  try {
    response = await fetchFn(PUSH_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: envelopes }),
    });
  } catch {
    return retryAll(envelopes);
  }
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: unknown } } | null;
    const message =
      typeof body?.error?.message === "string" ? body.error.message : "This entry couldn't be sent.";
    return envelopes.map((e) => ({ id: e.id, status: "rejected", code: "invalid", message }));
  }
  if (!response.ok) return retryAll(envelopes);
  const body = (await response.json().catch(() => null)) as PushResponse | null;
  const byId = new Map((body?.results ?? []).map((r) => [r.id, r]));
  return envelopes.map((e) => byId.get(e.id) ?? { id: e.id, status: "retry" });
}

/** Builds and sends one field entry; the result for its id. */
export async function submit<T extends MutationType>(
  type: T,
  payload: MutationPayloads[T],
  options: SubmitOptions = {},
): Promise<PushResult> {
  const [result] = await submitMany([buildEnvelope(type, payload, options)], options);
  if (result!.status === "retry") noteWaiting();
  return result!;
}
