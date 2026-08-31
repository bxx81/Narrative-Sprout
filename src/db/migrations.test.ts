import { describe, expect, test } from "bun:test";
import {
  assertSupportedSchemaVersion,
  CURRENT_SCHEMA_VERSION,
  migrations,
  UnsupportedSchemaVersionError,
} from "./migrations";

describe("schema versioning framework", () => {
  test("launches at schema version 1 with an empty migration chain", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(migrations).toEqual({});
  });

  test("accepts records at the current version", () => {
    expect(() =>
      assertSupportedSchemaVersion({ schemaVersion: CURRENT_SCHEMA_VERSION }),
    ).not.toThrow();
  });

  test("accepts older records (they go through the migration chain)", () => {
    expect(() => assertSupportedSchemaVersion({ schemaVersion: 1 })).not.toThrow();
  });

  test("rejects records newer than this build, naming both versions", () => {
    const newer = CURRENT_SCHEMA_VERSION + 1;
    try {
      assertSupportedSchemaVersion({ schemaVersion: newer });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedSchemaVersionError);
      const typed = error as UnsupportedSchemaVersionError;
      expect(typed.foundVersion).toBe(newer);
      expect(typed.supportedVersion).toBe(CURRENT_SCHEMA_VERSION);
    }
  });
});
