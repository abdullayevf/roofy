import qrcode from "qrcode-generator";
import { cx } from "@/lib/cx";

/**
 * A QR code for `value`, drawn as one inline SVG path (no image to load, works offline). Dark squares on a light
 * square with a 4-module quiet zone in both themes, so a phone camera reads it either way.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  let d = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  const size = n + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cx(
        "aspect-square w-48 max-w-full shrink-0 rounded-sm border border-line bg-on-chalk text-on-tape",
        className,
      )}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
