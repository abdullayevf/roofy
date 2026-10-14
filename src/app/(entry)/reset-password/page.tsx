import type { Metadata } from "next";
import { getDemo } from "@/data";
import type { SearchParams } from "@/data/session";
import type { AuthDemo } from "@/components/screens/auth-form";
import { ResetPasswordForm } from "@/components/screens/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** The reset email's link lands here with `?token=`. The `?demo=` states: loading, offline, error. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const demo = await getDemo({ searchParams: Promise.resolve(params) });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  const raw = params.token;
  const token = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title text-ink">Choose a new password</h1>
        <p className="entry-intro text-body text-ink-2">Set a new password for your Roofy account.</p>
      </div>
      <ResetPasswordForm token={token} demo={state} />
    </>
  );
}
