import type { Transaction } from "dexie";
import type { GameRecord } from "../types/game";

/**
 * Application-data migration chain (REDESIGN.md §5.6).
 *
 * Rules:
 * - `CURRENT_SCHEMA_VERSION` is bumped whenever a GameRecord's shape changes.
 * - Every bump MUST add `migrations[N]` that upgrades data from N-1 to N.
 * - Migration code runs BEFORE any Zod parsing of the affected records
 *   (Zod strips unknown keys; old fields must be read before validation).
 * - Data with a version higher than this app supports is never modified and
 *   is reported as unplayable rather than deleted (non-destructive policy).
 */

export const CURRENT_SCHEMA_VERSION = 1;

export type MigrationFunction = (transaction: Transaction) => Promise<void>;

/**
 * Version N → N+1 upgrade functions. Empty at launch by design; the mechanism
 * exists from day one so future changes never need ad-hoc conversion code.
 */
export const migrations: Record<number, MigrationFunction> = {
  // 2: async (tx) => { /* upgrade records from schema 1 to 2 */ },
};

export class UnsupportedSchemaVersionError extends Error {
  constructor(
    public readonly foundVersion: number,
    public readonly supportedVersion: number,
  ) {
    super(
      `Save data schema version ${foundVersion} is not supported by this app ` +
        `(supports up to ${supportedVersion}).`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

/**
 * Throws if a game record's schema version is newer than this build supports.
 * Outdated data (lower version) is left for the migration chain to handle.
 */
export function assertSupportedSchemaVersion(record: Pick<GameRecord, "schemaVersion">): void {
  if (record.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(record.schemaVersion, CURRENT_SCHEMA_VERSION);
  }
}
