import type { Metadata } from "next";
import { getDemo } from "@/data";
import type { SearchParams } from "@/data/session";
import type { AuthDemo } from "@/components/screens/auth-form";
import { ForgotPasswordForm } from "@/components/screens/forgot-password-form";

export const metadata: Metadata = { title: "Forgot your password?" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** Forgot password. The `?demo=` states: loading (button busy), offline (Needs connection), error (the sorry sentence). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const demo = await getDemo({ searchParams });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">Forgot your password?</h1>
        <p className="entry-intro text-body text-ink-2">Enter your email and we&apos;ll send a link to set a new one.</p>
      </div>
      <ForgotPasswordForm demo={state} />
    </>
  );
}
