import type { Metadata } from "next";
import { headers } from "next/headers";
import { getData } from "@/data";
import type { SearchParams } from "@/data/session";
import { NoPermission } from "@/components/page-states";
import { backLink, canOpen } from "@/components/shell/access";
import { InstallGuide, InstallGuideError } from "@/components/screens/install-guide";
import { detectPlatform, parsePlatform } from "@/lib/install-platform";

export const metadata: Metadata = { title: "Install guide" };

/**
 * Install guide. The steps for the browser's own device come first (user agent); `?platform=ios|android|desktop`
 * and `?installed=1` show another device's steps or the installed state in the prototype.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getData({ searchParams });
  const params = await searchParams;
  if (ctx.demo.state === "error") return <InstallGuideError backHref="/more" backLabel="Back to More" />;
  if (!canOpen(ctx.actor.role, "install") || ctx.demo.state === "noperm") {
    const back = backLink(ctx.actor.role);
    return <NoPermission backHref={back.href} backLabel={back.label} />;
  }
  const platform = parsePlatform(params.platform) ?? detectPlatform((await headers()).get("user-agent"));
  return <InstallGuide platform={platform} installed={params.installed === "1"} backHref="/more" backLabel="Back to More" />;
}
