import { describe, expect, test } from "bun:test";
import { NarrativeSproutDatabase } from "./database";

describe("database schema", () => {
  test("declares the five stores from REDESIGN §5.1", () => {
    const db = new NarrativeSproutDatabase();
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "assets",
      "credentials",
      "games",
      "nodes",
      "settings",
    ]);
    db.close();
  });

  test("games table is indexed for save-list sorting", () => {
    const db = new NarrativeSproutDatabase();
    const indexNames = db.games.schema.indexes.map((i) => i.name);
    expect(indexNames).toContain("lastPlayedAt");
    db.close();
  });

  test("nodes table has compound index for chronological scans", () => {
    const db = new NarrativeSproutDatabase();
    const compound = db.nodes.schema.indexes.map((i) => i.name);
    expect(compound).toContain("[gameId+turnNumber]");
    db.close();
  });
});
