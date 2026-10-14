import type { Metadata } from "next";
import { getDemo } from "@/data";
import type { SearchParams } from "@/data/session";
import { AuthForm, type AuthDemo } from "@/components/screens/auth-form";

export const metadata: Metadata = { title: "Create your account" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** Create your account. The `?demo=` states change the form: loading (button busy), offline (Needs connection), error (the sorry sentence). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = await getDemo({ searchParams });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">Create your account</h1>
        <p className="entry-intro text-body text-ink-2">Set up your business in a few minutes.</p>
      </div>
      <AuthForm mode="sign-up" demo={state} />
    </>
  );
}
