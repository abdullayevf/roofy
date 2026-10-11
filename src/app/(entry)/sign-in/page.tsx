import type { Metadata } from "next";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { AuthForm, type AuthDemo } from "@/components/screens/auth-form";

export const metadata: Metadata = { title: "Sign in" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** Sign in. The `?demo=` states change the form: loading (button busy), offline (Needs connection), error (the sorry sentence). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { demo } = await getData({ searchParams });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">Sign in</h1>
        <p className="entry-intro text-body text-ink-2">Welcome back. Pick up where the crew left off.</p>
      </div>
      <AuthForm mode="sign-in" demo={state} />
    </>
  );
}
