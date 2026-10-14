import type { Metadata } from "next";
import { getDemo } from "@/data";
import type { SearchParams } from "@/data/session";
import { VerifyEmail } from "@/components/screens/verify-email";
import type { AuthDemo } from "@/components/screens/auth-form";

export const metadata: Metadata = { title: "Verify your email" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** The verification email's link lands here with `?token=`. The `?demo=` states: loading, offline, error. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const demo = await getDemo({ searchParams: Promise.resolve(params) });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  const raw = params.token;
  const token = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
  return <VerifyEmail token={token} demo={state} />;
}
