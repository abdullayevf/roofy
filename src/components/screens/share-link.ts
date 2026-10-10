export const SHARE_COPIED = "Link copied. It works for 90 days.";
export const SHARE_FAILED = "Couldn't make the link. Try again.";

type ShareNav = {
  share?: (data: { title: string; url: string }) => Promise<void>;
  clipboard: { writeText: (text: string) => Promise<void> };
};

/**
 * Hands a statement link to the phone's share sheet, or copies it where there isn't one (desktop browsers).
 * Closing the share sheet without picking an app is not an error.
 */
export async function shareOrCopy(url: string, nav: ShareNav): Promise<"shared" | "copied"> {
  if (typeof nav.share === "function") {
    await nav.share({ title: "Pay statement", url }).catch(() => undefined);
    return "shared";
  }
  await nav.clipboard.writeText(url);
  return "copied";
}
