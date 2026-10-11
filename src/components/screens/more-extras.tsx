"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/theme";
import { setTheme } from "@/app/actions/theme";
import { signOut } from "@/app/actions/sign-out";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** More menu: the theme choice and Sign out. Both need a connection, so offline they say so once and wait. */
export function MoreExtras({ theme, demoOffline }: { theme: Theme; demoOffline: boolean }) {
  const router = useRouter();
  const online = useOnline(demoOffline);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="more-theme" className="flex flex-col gap-2">
        <h2 id="more-theme" className="text-heading text-ink">Theme</h2>
        <Segmented
          legend="Theme"
          name="theme"
          options={THEME_OPTIONS}
          value={theme}
          disabled={!online}
          onChange={(v) =>
            start(async () => {
              await setTheme(v as Theme);
              router.refresh();
            })
          }
        />
        <p className="text-body text-ink-2">System follows your phone or computer.</p>
      </section>
      <section aria-labelledby="more-account" className="flex flex-col gap-2">
        <h2 id="more-account" className="text-heading text-ink">Account</h2>
        {online ? null : (
          <p role="status" className="text-body text-ink">
            {NEEDS_CONNECTION}
          </p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="secondary" disabled={!online} className="w-full sm:w-auto sm:min-w-60">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
