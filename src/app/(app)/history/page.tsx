import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Record history" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="history"
      title="Record history"
      message="Changes will show here."
      actionLabel="Go to More"
      actionHref="/more"
      searchParams={searchParams}
    />
  );
}
