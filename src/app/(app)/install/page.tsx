import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { PlaceholderPage } from "../placeholder";

export const metadata: Metadata = { title: "Install guide" };

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <PlaceholderPage
      section="install"
      title="Install guide"
      message="Steps to put Roofy on your home screen will show here."
      actionLabel="Go to More"
      actionHref="/more"
      searchParams={searchParams}
    />
  );
}
