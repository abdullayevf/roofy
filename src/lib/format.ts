const GROUPED = new Intl.NumberFormat("en-AU");
const MINUS = "−";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNIT_LABEL = { m2: " m²", lm: " lm", each: "" } as const;

export function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  const cc = abs % 100;
  const text = `$${GROUPED.format((abs - cc) / 100)}.${String(cc).padStart(2, "0")}`;
  return cents < 0 ? `${MINUS}${text}` : text;
}

function hundredths(value: number): string {
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
  return value < 0 ? `${MINUS}${body}` : body;
}

export function formatQuantity(value: number, unit: keyof typeof UNIT_LABEL): string {
  return `${hundredths(value)}${UNIT_LABEL[unit]}`;
}

export function formatHours(value: number): string {
  return `${hundredths(value)} h`;
}

export function formatDays(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : "";
  if (abs === 50) return `${sign}½ day`;
  if (abs === 100) return `${sign}1 day`;
  return `${sign}${hundredths(abs)} days`;
}

/** "Mon 7 Sep", plus the year when it isn't today's year. Dates are "YYYY-MM-DD". */
export function formatDate(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const base = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return date.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${date.slice(0, 4)}`;
}

/** "Mon 28 Sep, 7:40 am": the date and time of an instant in `timeZone` (never the server's zone). */
export function formatDateTime(instant: string, timeZone: string, today: string): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return `${formatDate(date, today)}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`;
}

/** Hundredths (cents, quantities, hours) as a plain decimal for CSV: 143250 → "1432.50", ASCII minus. */
export function formatDecimal(value: number): string {
  const digits = String(Math.abs(value)).padStart(3, "0");
  return `${value < 0 ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
