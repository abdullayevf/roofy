import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { SettingsPageFrame } from "@/components/screens/settings-index";
import { CategoriesForm } from "@/components/screens/settings-lists";
import { settingsPage } from "../load-settings";

export const metadata: Metadata = { title: "Expense categories" };

const INTRO = "Expenses are filed under these names. Renaming a category renames it on every expense.";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return settingsPage(searchParams, { title: "Expense categories" }, async ({ data, actor, offline, empty }) => {
    const categories = empty ? [] : await data.workspace.categories(actor);
    return (
      <SettingsPageFrame title="Expense categories" intro={categories.length ? INTRO : "No expense categories yet. Add the first one below."}>
        <CategoriesForm categories={categories} demoOffline={offline} />
      </SettingsPageFrame>
    );
  });
}
