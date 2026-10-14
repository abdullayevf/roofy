import type { Metadata } from "next";
import { getDemo } from "@/data";
import type { SearchParams } from "@/data/session";
import { TwoFactorStep } from "@/components/screens/two-factor-step";
import type { AuthDemo } from "@/components/screens/auth-form";

export const metadata: Metadata = { title: "Enter your code" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** Sign in, second step. The `?demo=` states: loading, offline, error. */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const demo = await getDemo({ searchParams: Promise.resolve(params) });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  return <TwoFactorStep demo={state} />;
}
