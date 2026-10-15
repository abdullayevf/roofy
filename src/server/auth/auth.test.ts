import { describe, expect, it } from "vitest";
import { APIError } from "better-auth/api";
import { DataError } from "@/data/contracts";
import { asApiError } from "./auth";

const BRAND: unique symbol = Symbol.for("roofy.DataError");

/** An error as another bundle's copy of `DataError` throws it: same brand, code and issues, but not an instance of ours. */
class OtherCopyDataError extends Error {
  readonly [BRAND] = true;
  readonly issues = [];
  constructor(readonly code: "forbidden" | "invalid", message: string) {
    super(message);
  }
}

describe("asApiError", () => {
  it("answers a forbidden refusal as 403 and any other as 400, with the code and the plain sentence", () => {
    const forbidden = asApiError(new DataError("forbidden", "Not yours.")) as APIError;
    expect(forbidden).toBeInstanceOf(APIError);
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toMatchObject({ code: "FORBIDDEN", message: "Not yours." });
    const invalid = asApiError(new DataError("invalid", "Pick a role.")) as APIError;
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toMatchObject({ code: "INVALID" });
  });

  it("does the same for a DataError thrown by another bundle's copy of the class", () => {
    const forbidden = asApiError(new OtherCopyDataError("forbidden", "Not yours.")) as APIError;
    expect(forbidden).toBeInstanceOf(APIError);
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body).toMatchObject({ code: "FORBIDDEN", message: "Not yours." });
  });

  it("passes anything else through untouched", () => {
    const other = new Error("boom");
    expect(asApiError(other)).toBe(other);
    expect(asApiError("text")).toBe("text");
  });
});
