// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { DialogPanel } from "./dialog";
import { SheetPanel } from "./sheet";
import { PANEL_GRABBER, PANEL_PAD_X, PANEL_TOP } from "./panel-chrome";

const tokens = (el: Element | null | undefined) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("the remove-person confirm and the change-role sheet share their chrome (auth i2 D29)", () => {
  it("has the same grabber, the same offset from the top and the same side padding", () => {
    const dialog = render(
      <DialogPanel title="Remove Priya Shah?" confirmLabel="Remove from team" tone="danger" />,
    ).container;
    const sheet = render(
      <SheetPanel title="Change role" primaryAction={<button>Save role</button>}>
        <p>Priya Shah</p>
      </SheetPanel>,
    ).container;
    const grabbers = [dialog, sheet].map((c) => c.querySelector('[aria-hidden="true"]')!);
    expect(tokens(grabbers[0])).toEqual(expect.arrayContaining(PANEL_GRABBER.split(" ")));
    expect(tokens(grabbers[1])).toEqual(expect.arrayContaining(PANEL_GRABBER.split(" ")));
    const panels = [dialog.firstElementChild!, sheet.firstElementChild!];
    for (const panel of panels) expect(tokens(panel)).toEqual(expect.arrayContaining(PANEL_TOP.split(" ")));
    // The dialog pads its own sides; the sheet pads its body and its action row: all 16 px on a phone.
    expect(tokens(panels[0])).toEqual(expect.arrayContaining(PANEL_PAD_X.split(" ")));
    const bodies = Array.from(sheet.querySelectorAll("div")).filter((d) => tokens(d).includes("px-4"));
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(PANEL_PAD_X).toBe("px-4 lg:px-6");
    expect(tokens(panels[0])).not.toContain("px-6");
  });
});
