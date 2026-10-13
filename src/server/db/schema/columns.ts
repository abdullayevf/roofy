// Column builders shared by every table. Each call returns fresh builders.
import { sql } from "drizzle-orm";
import { bigint, check, date, numeric, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/** Primary key: uuid v7, generated in the app (Better Auth is configured the same way in Task 8). */
export const id = () =>
  uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7());

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const timestamps = () => ({
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Money: bigint cents read as a JS number. Pair every money column with `centsInRange`. */
export const cents = (name: string) => bigint(name, { mode: "number" });

/** Quantities and hours: numeric(12,2), converted to integer hundredths by `convert.ts`. */
export const hundredths = (name: string) => numeric(name, { precision: 12, scale: 2 });

/** A local date in the workspace timezone, always a `YYYY-MM-DD` string, never a JS Date. */
export const localDate = (name: string) => date(name, { mode: "string" });

/** Money columns hold 0 … Number.MAX_SAFE_INTEGER cents, so `mode: "number"` never loses a cent. */
export const centsInRange = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} between 0 and ${sql.raw(String(Number.MAX_SAFE_INTEGER))}`);

/** Basis points: 0 … 10000. */
export const bpInRange = (name: string, column: AnyPgColumn) =>
  check(name, sql`${column} between 0 and 10000`);
