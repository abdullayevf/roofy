import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="settings"
      title="Settings"
      message="Business settings will show here."
      actionLabel="Go to More"
      actionHref="/more"
      searchParams={searchParams}
    />
  );
}
