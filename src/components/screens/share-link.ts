export const SHARE_COPIED = "Link copied. It works for 90 days.";
/** The manager's Share statement button: it makes a link, so a failure is about making it. */
export const SHARE_FAILED = "Couldn't make the link. Try again.";
/** The public statement page: the link is the page's own address, so only the copy can fail. */
export const COPY_FAILED = "Couldn't copy the link. Select the address bar and copy it.";

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

/** Share on the statement page itself: like `shareOrCopy`, but a failed copy comes back as "failed" to show. */
export async function shareThisPage(url: string, nav: ShareNav): Promise<"shared" | "copied" | "failed"> {
  return shareOrCopy(url, nav).catch(() => "failed" as const);
}
