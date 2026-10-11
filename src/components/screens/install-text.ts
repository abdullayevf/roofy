import type { InstallPlatform } from "@/lib/install-platform";

/** The steps to put Roofy on the home screen, per device. Plain words, one action per step. */
export const INSTALL_STEPS: Record<InstallPlatform, { title: string; steps: string[] }> = {
  ios: {
    title: "On iPhone or iPad (Safari)",
    steps: [
      "Open Roofy in Safari.",
      "Tap the Share button at the bottom of the screen.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add. Roofy now sits on your home screen.",
    ],
  },
  android: {
    title: "On Android (Chrome)",
    steps: [
      "Open Roofy in Chrome.",
      "Tap the menu button, the three dots at the top right.",
      "Tap Install app. If you see Add to Home screen instead, tap that.",
      "Tap Install. Roofy now sits on your home screen.",
    ],
  },
  desktop: {
    title: "On a computer (Chrome or Edge)",
    steps: [
      "Open Roofy in Chrome or Edge.",
      "Click the install icon at the right end of the address bar.",
      "Click Install. Roofy opens in its own window.",
    ],
  },
};

export const INSTALL_ORDER: InstallPlatform[] = ["ios", "android", "desktop"];

/** The platform's steps first, the other two after it in the usual order. */
export function installOrder(first: InstallPlatform): { first: InstallPlatform; others: InstallPlatform[] } {
  return { first, others: INSTALL_ORDER.filter((p) => p !== first) };
}
