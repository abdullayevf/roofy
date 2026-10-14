/**
 * What a phone bottom sheet and a confirm dialog share, so the two never drift apart (auth i2 D29: the remove-person
 * confirm had 24 px side padding and a different grabber offset beside the 16 px change-role sheet).
 */

/** Side padding of the title, text and buttons: 16 px on a phone, 24 px from 1024 px. */
export const PANEL_PAD_X = "px-4 lg:px-6";

/**
 * The grabber sits 8 px below the panel's top edge, phone only. The offset is the panel's own top padding (`pt-2`), not a
 * margin on the grabber: a first child's margin collapses out of a panel with no padding, which left the sheet's grabber
 * on its very top edge and the dialog's 8 px in.
 */
export const PANEL_TOP = "pt-2";
export const PANEL_GRABBER = "mx-auto h-1.5 w-10 rounded-full bg-line lg:hidden";

/** Space under the buttons before the home indicator's inset, px. */
export const PANEL_BOTTOM_GAP = 16;
