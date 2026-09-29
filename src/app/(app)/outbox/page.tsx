import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Outbox" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="outbox"
      title="Outbox"
      message="Nothing is waiting to send."
      actionLabel="Go to Log"
      actionHref="/log"
      searchParams={searchParams}
    />
  );
}
