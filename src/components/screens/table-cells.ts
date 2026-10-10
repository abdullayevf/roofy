// Table cell classes shared by the Jobs and Crew tables. A plain module (not "use client"), so a server component can
// read the strings: importing them from a client file hands a server component a reference, not the class names.
export const TH = "px-4 py-2 text-left text-meta text-ink font-normal";
// A chip line is 24 px tall (its icon), so with the 24 px name the cell is 48 px; py-0.5 keeps the row at 53 px, under the 56 px cap.
export const TD = "px-4 py-0.5 align-middle";
