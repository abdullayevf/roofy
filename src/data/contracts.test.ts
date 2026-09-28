import { describe, expect, it } from "vitest";
import {
  DataError,
  isDataError,
  type CrewDayDefaults,
  type CrewList,
  type EntryResult,
  type ExpenseDetail,
  type ExpenseList,
  type ExpenseCategory,
  type HomeForeman,
  type HomeManager,
  type HomeView,
  type LogList,
  type NoWorkRow,
  type ProgressDefaults,
  type ProgressService,
  type ProjectDetail,
  type ProjectList,
  type PushResponse,
  type SameAsYesterday,
  type Snapshot,
  type StageDetail,
  type WorkspaceView,
} from "./contracts";

// Compile-time mirror of MONEY_KEY in ./dto: every key path in a type whose lowercased key
// contains a money word. `tsc` (pnpm typecheck) fails if a foreman type gains one.
type Needle =
  "rate" | "amount" | "cents" | "budget" | "margin" | "balance" | "cost" | "earn" | "pay" | "total" | "gst";
type IsMoneyKey<K extends string> = Lowercase<K> extends `${string}${Needle}${string}` ? true : false;
type MoneyPaths<T, P extends string = "$"> = T extends readonly (infer U)[]
  ? MoneyPaths<U, `${P}[]`>
  : T extends object
    ? {
        [K in keyof T & string]:
          (IsMoneyKey<K> extends true ? `${P}.${K}` : never) | MoneyPaths<T[K], `${P}.${K}`>;
      }[keyof T & string]
    : never;
type Foreman<T> = Extract<T, { view: "foreman" }>;
type Manager<T> = Extract<T, { view: "manager" }>;
type Equal<A, B> = (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2 ? true : false;
type NoMoney<T> = Equal<MoneyPaths<T>, never>;
type HasMoney<T> = NoMoney<T> extends true ? false : true;

type ProgressByStage = Awaited<ReturnType<ProgressService["byStage"]>>;

// Every foreman-reachable read: the foreman branch (or the single role-free type) is money-free.
const foremanShapes: [
  NoMoney<Foreman<ProjectList>>,
  NoMoney<Foreman<ProjectDetail>>,
  NoMoney<Foreman<StageDetail>>,
  NoMoney<Foreman<CrewList>>,
  NoMoney<Foreman<CrewDayDefaults>>,
  NoMoney<Foreman<LogList>>,
  NoMoney<Foreman<ExpenseList>>,
  NoMoney<Foreman<ExpenseDetail>>,
  NoMoney<Foreman<WorkspaceView>>,
  NoMoney<Foreman<HomeView>>,
  NoMoney<HomeForeman>,
  NoMoney<Foreman<ProgressByStage>>,
  NoMoney<ProgressDefaults>,
  NoMoney<SameAsYesterday>,
  NoMoney<NoWorkRow>,
  NoMoney<ExpenseCategory>,
  NoMoney<Snapshot>,
  NoMoney<EntryResult>,
  NoMoney<PushResponse>,
] = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

// Positive control: the checker does see money in the manager branches.
const managerShapes: [
  HasMoney<Manager<ProjectDetail>>,
  HasMoney<Manager<StageDetail>>,
  HasMoney<Manager<CrewList>>,
  HasMoney<Manager<CrewDayDefaults>>,
  HasMoney<HomeManager>,
] = [true, true, true, true, true];

describe("contracts", () => {
  it("declares foreman DTOs without money fields (checked by tsc)", () => {
    expect(foremanShapes.every(Boolean)).toBe(true);
    expect(managerShapes.every(Boolean)).toBe(true);
  });

  it("DataError carries a code, a safe message and field issues", () => {
    const e = new DataError("invalid", "Add a total before saving.", [
      { field: "totalCents", message: "Add a total before saving." },
    ]);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("DataError");
    expect(e.code).toBe("invalid");
    expect(e.issues).toHaveLength(1);
    expect(isDataError(e)).toBe(true);
    expect(isDataError(new Error("x"))).toBe(false);
    expect(new DataError("forbidden", "You don't have access to this. Ask your manager.").issues).toEqual([]);
  });
});
