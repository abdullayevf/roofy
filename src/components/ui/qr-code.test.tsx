// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrCode } from "./qr-code";

const pathOf = () => screen.getByRole("img").querySelector("path")!.getAttribute("d")!;

describe("QrCode", () => {
  it("is one labelled picture drawn from the value, with a quiet zone around it", () => {
    render(
      <QrCode value="otpauth://totp/Roofy:a?secret=ABCD" label="Scan this with your authenticator app" />,
    );
    const svg = screen.getByRole("img", { name: "Scan this with your authenticator app" });
    const [x0, y0, w, h] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect([x0, y0]).toEqual([0, 0]);
    expect(w).toBe(h);
    // Every dark square sits at least 4 modules in from the edge.
    const squares = [...pathOf().matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    expect(squares.length).toBeGreaterThan(50);
    for (const [x, y] of squares) {
      expect(x).toBeGreaterThanOrEqual(4);
      expect(y).toBeGreaterThanOrEqual(4);
      expect(x).toBeLessThan(w! - 4);
      expect(y).toBeLessThan(h! - 4);
    }
  });

  it("holds the value it is given: a different link draws a different picture", () => {
    const a = render(<QrCode value="otpauth://totp/Roofy:a?secret=AAAAAAAAAAAAAAAA" label="one" />);
    const first = pathOf();
    a.unmount();
    render(<QrCode value="otpauth://totp/Roofy:a?secret=BBBBBBBBBBBBBBBB" label="two" />);
    expect(pathOf()).not.toBe(first);
  });
});
