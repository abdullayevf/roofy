import { describe, expect, it, vi } from "vitest";
import { SHARE_COPIED, shareOrCopy } from "./share-link";

describe("shareOrCopy", () => {
  it("hands the link to the phone's share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    await expect(shareOrCopy("https://x/s/abc", { share, clipboard: { writeText } })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Pay statement", url: "https://x/s/abc" });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("a closed share sheet is not an error", async () => {
    const share = vi.fn().mockRejectedValue(new Error("AbortError"));
    await expect(shareOrCopy("u", { share, clipboard: { writeText: vi.fn() } })).resolves.toBe("shared");
  });

  it("copies the link where there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(shareOrCopy("https://x/s/abc", { clipboard: { writeText } })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("https://x/s/abc");
    expect(SHARE_COPIED).toBe("Link copied. It works for 90 days.");
  });
});
