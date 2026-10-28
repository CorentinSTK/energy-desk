import { describe, expect, it } from "vitest";

import { describeDatabaseError } from "./errors";

describe("describeDatabaseError", () => {
  it("keeps name, code and message but masks credentials", () => {
    const error = Object.assign(
      new Error("connect failed for postgresql://web_reader.abc:s3cret@host:6543/postgres"),
      { code: "28P01" },
    );
    const text = describeDatabaseError(error);
    expect(text).toBe("Error [28P01]: connect failed for postgresql://***@host:6543/postgres");
    expect(text).not.toContain("s3cret");
  });

  it("handles non-errors", () => {
    expect(describeDatabaseError("boom")).toBe("boom");
  });
});
