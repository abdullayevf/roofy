import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Pay runs" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="pay"
      title="Pay runs"
      message="Pay runs will show here."
      actionLabel="Go to Home"
      actionHref="/"
      searchParams={searchParams}
    />
  );
}
