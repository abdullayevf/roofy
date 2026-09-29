import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Expenses" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="expenses"
      title="Expenses"
      message="Expenses will show here."
      actionLabel="Go to Home"
      actionHref="/"
      searchParams={searchParams}
    />
  );
}
