import { describe, expect, test } from "bun:test";
import { db } from "../../db/database";
import { gameRepository } from "../../db/gameRepository";
import { BackupCryptoError } from "../../lib/crypto";
import { buildBackupPayloadBundle, createPayloadZipBlob } from "./backupPayload";
import { createEncryptedEnvelope, parseEnvelopeJson, serializeEnvelope } from "./envelope";
import { restoreBackupFromEnvelopeText } from "./restoreBackup";
import {
  makeTestAsset,
  makeTestGame,
  makeTestNode,
  wipeDatabaseForTest,
} from "./testsupport/records";

async function createEnvelopeTextForSeededData(
  mutateNodeJson?: (path: string) => string,
): Promise<string> {
  const game = makeTestGame("game-1", "壊れやすいセーブ");
  const node1 = makeTestNode("game-1", "game-1-node-1", 1);
  const node2 = makeTestNode("game-1", "game-1-node-2", 2);
  await db.transaction("rw", [db.games, db.nodes, db.assets], async () => {
    await db.games.put(game);
    await db.nodes.bulkPut([node1, node2]);
    await db.assets.put(makeTestAsset("game-1-node-1", [9, 9, 9]));
  });
  const source = await import("./createBackup").then((m) => m.collectBackupSourceData());
  const bundle = buildBackupPayloadBundle(
    source.games,
    source.nodes,
    source.assets,
    source.settings,
  );
  if (mutateNodeJson && bundle.nodeFiles[1]) {
    bundle.nodeFiles[1].json = mutateNodeJson(bundle.nodeFiles[1].path);
  }
  const payloadBlob = await createPayloadZipBlob(bundle);
  const envelope = await createEncryptedEnvelope(
    new Uint8Array(await payloadBlob.arrayBuffer()),
    "pw",
  );
  return serializeEnvelope(envelope);
}

describe("restore error handling (non-destructive, §5.6/§5.7)", () => {
  test("wrong passphrase is rejected with a clear error", async () => {
    const envelopeText = await createEnvelopeTextForSeededData();
    expect(restoreBackupFromEnvelopeText(envelopeText, "wrong-passphrase")).rejects.toBeInstanceOf(
      BackupCryptoError,
    );
    await wipeDatabaseForTest();
  });

  test("tampered ciphertext is rejected", async () => {
    const envelopeText = await createEnvelopeTextForSeededData();
    const envelope = parseEnvelopeJson(envelopeText);
    const tampered = serializeEnvelope({
      ...envelope,
      cipher: { ...envelope.cipher, data: envelope.cipher.data.slice(0, -4) + "AAAA" },
    });
    expect(restoreBackupFromEnvelopeText(tampered, "pw")).rejects.toBeInstanceOf(BackupCryptoError);
    await wipeDatabaseForTest();
  });

  test("future envelope versions are refused instead of guessed", async () => {
    const envelopeText = await createEnvelopeTextForSeededData();
    const envelope = parseEnvelopeJson(envelopeText);
    const future = serializeEnvelope({ ...envelope, version: envelope.version + 1 });
    expect(restoreBackupFromEnvelopeText(future, "pw")).rejects.toThrow(
      /Unsupported backup version/,
    );
    await wipeDatabaseForTest();
  });

  test("structurally invalid envelopes are refused", async () => {
    expect(() => parseEnvelopeJson("not json at all")).toThrow(/not a valid ns-backup/);
    expect(() => parseEnvelopeJson(JSON.stringify({ format: "ns-backup", version: 1 }))).toThrow(
      /not a valid ns-backup/,
    );
  });

  test("invalid node records are skipped; valid data still restores", async () => {
    const envelopeText = await createEnvelopeTextForSeededData((path) => {
      expect(path).toBe("nodes/game-1-node-2.json");
      return JSON.stringify({ id: "game-1-node-2", totallyWrong: true });
    });
    // Start from an empty database: only what the restore writes may exist.
    await wipeDatabaseForTest();

    const summary = await restoreBackupFromEnvelopeText(envelopeText, "pw");
    expect(summary.restoredGameCount).toBe(1);
    expect(summary.restoredNodeCount).toBe(1); // node-2 skipped, node-1 restored

    const restoredNodes = await gameRepository.getNodesOfGame("game-1");
    expect(restoredNodes.map((node) => node.id as string)).toEqual(["game-1-node-1"]);
    await wipeDatabaseForTest();
  });
});
