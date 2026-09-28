/** Integer cents. $1,432.50 = 143250. */
export type Cents = number;
/** Integer hundredths: quantities, hours, days, multipliers. 7.5 h = 750; ½ day = 50; ×1.5 = 150. */
export type Hundredths = number;
/** Integer basis points. 25% = 2500; 100% = 10000. */
export type BasisPoints = number;
/** Local calendar date in the workspace timezone, "YYYY-MM-DD". */
export type LocalDate = string;

export type Basis = "hourly" | "daily" | "per_unit" | "lump_sum" | "time_only";
export type RateBasis = "hourly" | "daily" | "per_unit";
export type Unit = "m2" | "lm" | "each";
export type WorkerType = "employee" | "contractor";
export type LogSource = "grid" | "progress" | "lump_sum" | "adjustment";
