"use client";

import { useState } from "react";
import { dataThemeFor, parseTheme, themeCookieString, type Theme } from "@/lib/theme";
import { signOut } from "@/app/actions/sign-out";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { NEEDS_CONNECTION, useOnline } from "./use-online";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * More menu: the theme choice and Sign out. The theme is kept on this device (a cookie the page writes itself), so it
 * works with no connection; Sign out needs one, so offline it is disabled with the sentence under it.
 */
export function MoreExtras({ theme, demoOffline }: { theme: Theme; demoOffline: boolean }) {
  const online = useOnline(demoOffline);
  const [chosen, setChosen] = useState<Theme>(theme);
  function choose(value: string) {
    const next = parseTheme(value);
    setChosen(next);
    document.cookie = themeCookieString(next);
    const attr = dataThemeFor(next);
    if (attr) document.documentElement.setAttribute("data-theme", attr);
    else document.documentElement.removeAttribute("data-theme");
  }
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="more-theme" className="flex flex-col gap-2">
        <h2 id="more-theme" className="text-heading text-ink">Theme</h2>
        <Segmented
          legend="Theme"
          name="theme"
          options={THEME_OPTIONS}
          value={chosen}
          onChange={choose}
        />
        <p className="text-body text-ink-2">System follows your phone or computer.</p>
      </section>
      <section aria-labelledby="more-account" className="flex flex-col gap-2">
        <h2 id="more-account" className="text-heading text-ink">Account</h2>
        <form action={signOut} className="flex flex-col gap-2">
          <Button type="submit" variant="secondary" disabled={!online} className="w-full sm:w-auto sm:min-w-60">
            Sign out
          </Button>
          {online ? null : (
            <p role="status" className="text-body text-ink">
              {NEEDS_CONNECTION}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
