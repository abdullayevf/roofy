import type { Metadata } from "next";
import type { SearchParams } from "@/data/session";
import { EMAIL_MAX } from "@/lib/auth-input";
import { CheckEmail } from "@/components/screens/check-email";

export const metadata: Metadata = { title: "Check your email" };

/** After sign-up. `?email=` names where the link went (shown as text, cut to the longest valid address). */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = (await searchParams).email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, EMAIL_MAX);
  return <CheckEmail email={email ? email : null} />;
}
