import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Workspace export" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="export"
      title="Workspace export"
      message="Your data download will be here."
      actionLabel="Go to More"
      actionHref="/more"
      searchParams={searchParams}
    />
  );
}
