import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Roofy", default: "Roofy" },
};

/**
 * Sign in, sign up and set-up: outside the app shell, so no tab bar. One galv page with one centred 448 px column on
 * every width; the wordmark sits in that column above the form, so it lines up with it on a phone, on its side and on
 * a desktop. Pads with the device's safe areas.
 */
export default function EntryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="flex min-h-dvh"
      style={{
        paddingTop: "max(var(--sat-sim, 0px), env(safe-area-inset-top))",
        paddingBottom: "max(var(--sab-sim, 0px), env(safe-area-inset-bottom))",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col px-4 lg:justify-center lg:py-16">
        <header className="entry-header flex flex-col pt-6 lg:pt-0">
          <p className="font-display text-title text-ink">Roofy</p>
        </header>
        <main className="entry-main flex flex-1 flex-col justify-start gap-6 pb-4 pt-6 lg:flex-none lg:pb-0">{children}</main>
      </div>
    </div>
  );
}
