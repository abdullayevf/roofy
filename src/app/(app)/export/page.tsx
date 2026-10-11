import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen, whoToAsk } from "@/components/shell/access";
import { ExportError, ExportScreen, ExportSkeleton } from "@/components/screens/export-workspace";
import { load, updatedText } from "../reports/load-reports";

export const metadata: Metadata = { title: "Workspace export" };

/**
 * Workspace export (flows.md screen 26): the files an export holds, the attachments, and one Export workspace button.
 * Owner only; everyone else gets no permission and no list. Offline the list reads and the button says Needs connection.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { data, actor, demo } = await getData({ searchParams });
  const back = backLink(actor.role);
  if (!canOpen(actor.role, "export")) return <NoPermission backHref={back.href} backLabel={back.label} ask={whoToAsk(actor.role)} />;
  const updated = updatedText(demo.offline);
  if (demo.loading) return <ExportSkeleton updated={updated} />;
  const result = await load(() => data.exports.listing(actor));
  if (result.kind === "forbidden") return <NoPermission backHref={back.href} backLabel={back.label} ask={whoToAsk(actor.role)} />;
  if (result.kind === "unavailable") return <ExportError updated={updated} />;
  return <ExportScreen files={result.value.files} attachments={result.value.attachments} updated={updated} demoOffline={demo.offline} />;
}
