import type { Metadata } from "next";
import { getAuth, getDemo } from "@/data";
import { isDataError } from "@/data/contracts";
import type { SearchParams } from "@/data/session";
import { InviteJoin, type InviteView } from "@/components/screens/invite-join";
import type { AuthDemo } from "@/components/screens/auth-form";
import { SIGN_IN_AGAIN } from "@/lib/auth-input";

export const metadata: Metadata = { title: "Join your team" };

const DEMOS: readonly string[] = ["loading", "offline", "error"];

/** The invite email's link. Shows the team and role first; a cancelled, used or expired invite says so. The `?demo=` states: loading, offline, error. */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const demo = await getDemo({ searchParams: Promise.resolve(query) });
  const state = demo.state && DEMOS.includes(demo.state) ? (demo.state as AuthDemo) : null;
  let view: InviteView;
  if (state === "error") view = { kind: "failed" };
  else
    try {
      view = { kind: "ready", invite: await getAuth().inviteDetails(id) };
    } catch (e) {
      if (isDataError(e) && e.message === SIGN_IN_AGAIN)
        view = {
          kind: "sign-in",
          message: "Sign in or create an account with the email this invite was sent to. You'll come back here to join.",
        };
      else if (isDataError(e) && e.code !== "unavailable") view = { kind: "gone", message: e.message };
      else view = { kind: "failed" };
    }
  return <InviteJoin id={id} view={view} demo={state} />;
}
