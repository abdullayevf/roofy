import { DEMO_STATES } from "@/data/contracts";

/**
 * The Outbox address. Phase 2's outbox is driven by `?demo=` (Phase 5 reads the phone's own queue), so a link to
 * it keeps the demo state the person is looking at; otherwise the outbox they tap through to would be empty.
 * Only a known demo state rides along.
 */
export function outboxHref(demo: string | null | undefined): string {
  return demo && (DEMO_STATES as readonly string[]).includes(demo) ? `/outbox?demo=${encodeURIComponent(demo)}` : "/outbox";
}
