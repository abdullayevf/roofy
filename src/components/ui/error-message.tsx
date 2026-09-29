import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";

/** A field's error line: icon first, then the message saying how to fix it (colour is never alone). */
export function ErrorMessage({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="flex items-start gap-2 text-meta text-over">
      <WarningCircle size={24} aria-hidden="true" className="shrink-0" />
      {children}
    </span>
  );
}
