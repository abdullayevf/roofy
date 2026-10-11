import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Roofy", default: "Roofy" },
};

/**
 * Sign in, sign up and set-up: outside the app shell, so no tab bar. One centred column on a phone; from 1024 px
 * the brand sits on the left and the form on the right, so the width is used. Pads with the device's safe areas.
 */
export default function EntryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2"
      style={{
        paddingTop: "max(var(--sat-sim, 0px), env(safe-area-inset-top))",
        paddingBottom: "max(var(--sab-sim, 0px), env(safe-area-inset-bottom))",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <header className="entry-header flex flex-col gap-3 px-4 pt-6 lg:justify-center lg:gap-4 lg:border-r lg:border-line lg:bg-surface lg:px-16 lg:pt-0">
        <p className="font-display text-title text-ink">Roofy</p>
        <p className="hidden max-w-md text-body text-ink-2 lg:block">
          Crew and job costing for roofing businesses. Log the day on site, then see what each job is making.
        </p>
      </header>
      <main className="entry-main mx-auto flex w-full max-w-md flex-1 flex-col justify-start gap-6 p-4 lg:justify-center lg:p-16">{children}</main>
    </div>
  );
}
