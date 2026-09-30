/**
 * The Outbox address. Phase 2's outbox is driven by `?demo=` (Phase 5 reads the phone's own queue), so a link to
 * it keeps the demo state the person is looking at; otherwise the outbox they tap through to would be empty.
 */
export function outboxHref(demo: string | null | undefined): string {
  return demo ? `/outbox?demo=${encodeURIComponent(demo)}` : "/outbox";
}
