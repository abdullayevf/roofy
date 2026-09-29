import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Jobs" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="jobs"
      title="Jobs"
      message="Your jobs will show here."
      actionLabel="Go to Home"
      actionHref="/"
      searchParams={searchParams}
    />
  );
}
