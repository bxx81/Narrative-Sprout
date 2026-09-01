import { afterEach, describe, expect, test } from "bun:test";
import { strFromU8, unzip } from "fflate";
import { db } from "../../db/database";
import { buildBackupPayloadBundle } from "./backupPayload";
import { collectBackupSourceData, createBackupFile } from "./createBackup";
import { decryptEnvelope, parseEnvelopeJson } from "./envelope";
import { uploadBackupToDrive } from "./driveBackup";
import { decodeBase64 } from "../../lib/crypto";
import {
  makeTestAsset,
  makeTestGame,
  makeTestNode,
  makeTestSettings,
  wipeDatabaseForTest,
} from "./testsupport/records";

/**
 * Completion condition of Phase 5 (REDESIGN §9): PROVE by test that plaintext
 * never leaves the app — neither through the local download nor the Google
 * Drive upload path. Only the ns-backup envelope (base64 ciphertext) may cross
 * the boundary, and credentials must not be reachable at all (§5.4).
 */

const SECRET_CREDENTIAL = "sk-or-v1-SUPER-SECRET-KEY";

const PLAINTEXT_MARKERS = [
  "きみと歩む夏の物語", // save title
  "game-1-node-2 の本文", // scene text
  "game-1-node-2 への指示文", // promptSent
  "game-1-node-2 のメモ", // memory notes
  "復号できないはずの世界設定", // attachment text
  "test/model-x", // settings value
  "127.0.0.1:7860", // settings endpoint (contains non-base64 chars)
];

function extractBase64Fields(text: string): string[] {
  return [...text.matchAll(/"(?:data|salt|iv)":\s*"([A-Za-z0-9+/=]+)"/g)].map((match) => match[1]);
}

function expectAbsentEverywhere(text: string, decodedBase64Texts: string[]): void {
  for (const marker of PLAINTEXT_MARKERS) {
    expect(text.includes(marker)).toBe(false);
    for (const decoded of decodedBase64Texts) {
      expect(decoded.includes(marker)).toBe(false);
    }
  }
  expect(text.includes(SECRET_CREDENTIAL)).toBe(false);
  for (const decoded of decodedBase64Texts) {
    expect(decoded.includes(SECRET_CREDENTIAL)).toBe(false);
  }
}

async function seedPlaintextDatabase(): Promise<void> {
  const game = makeTestGame("game-1", "きみと歩む夏の物語", {
    attachmentTexts: ["復号できないはずの世界設定"],
  });
  const node1 = makeTestNode("game-1", "game-1-node-1", 1);
  const node2 = makeTestNode("game-1", "game-1-node-2", 2);
  await db.transaction(
    "rw",
    [db.games, db.nodes, db.assets, db.settings, db.credentials],
    async () => {
      await db.games.put(game);
      await db.nodes.bulkPut([node1, node2]);
      await db.assets.put(makeTestAsset("game-1-node-1", [1, 2, 3]));
      await db.settings.put(makeTestSettings({ a1111Endpoint: "http://127.0.0.1:7860" }));
      await db.credentials.put({ key: "openrouterApiKey", value: SECRET_CREDENTIAL });
    },
  );
}

const capturedRequests: Array<{ url: string; bodyText: string; decodedBase64: string[] }> = [];

async function installFakeDriveFetch(): Promise<() => Promise<void>> {
  const originalFetch = globalThis.fetch;
  // @ts-expect-error test stub
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = init?.body;
    let bodyText = "";
    if (body instanceof Blob) bodyText = Buffer.from(await body.arrayBuffer()).toString("latin1");
    else if (typeof body === "string") bodyText = body;
    const decodedBase64 = extractBase64Fields(bodyText).map((field) =>
      Buffer.from(decodeBase64(field)).toString("utf8"),
    );
    capturedRequests.push({ url, bodyText, decodedBase64 });

    const json = (payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    if (url.includes("/drive/v3/files?") && url.includes("q=")) {
      return json({ files: [] }); // no folder yet
    }
    if (
      url.endsWith("/drive/v3/files?fields=id,name") ||
      url.includes("/drive/v3/files?fields=id,name")
    ) {
      return json({ id: "folder-1", name: "NarrativeSproutBackup" }); // create folder
    }
    if (url.includes("/upload/drive/v3/files")) {
      return json({ id: "file-1", name: "ns-backup.nsbak" });
    }
    return new Response("unexpected", { status: 404 });
  };
  return async () => {
    globalThis.fetch = originalFetch;
  };
}

afterEach(async () => {
  capturedRequests.length = 0;
  await wipeDatabaseForTest();
});

describe("plaintext never leaves the app (Phase 5 completion condition)", () => {
  test("positive control: the unencrypted payload contains the markers", async () => {
    await seedPlaintextDatabase();
    const source = await collectBackupSourceData();
    const bundle = buildBackupPayloadBundle(
      source.games,
      source.nodes,
      source.assets,
      source.settings,
    );
    const allJson = [
      ...bundle.gameFiles.map((f) => f.json),
      ...bundle.nodeFiles.map((f) => f.json),
      bundle.settingsJson ?? "",
    ].join("\n");
    for (const marker of PLAINTEXT_MARKERS) {
      expect(allJson.includes(marker)).toBe(true);
    }
  });

  test("local download: only the envelope crosses the boundary, secrets absent", async () => {
    await seedPlaintextDatabase();
    const { blob } = await createBackupFile("pass-phrase");
    const envelopeText = await blob.text();

    const decoded = extractBase64Fields(envelopeText).map((field) =>
      Buffer.from(decodeBase64(field)).toString("utf8"),
    );
    expectAbsentEverywhere(envelopeText, decoded);

    // The credential must not even be inside the encrypted payload.
    const payloadBytes = await decryptEnvelope(parseEnvelopeJson(envelopeText), "pass-phrase");
    const payloadEntries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
      unzip(payloadBytes, (error, data) => (error ? reject(error) : resolve(data)));
    });
    const payloadText = Object.values(payloadEntries)
      .map((bytes) => strFromU8(bytes))
      .join("\n");
    expect(payloadText.includes(SECRET_CREDENTIAL)).toBe(false);
  });

  test("Google Drive upload: request bytes carry no plaintext and no secrets", async () => {
    await seedPlaintextDatabase();
    const restoreFetch = await installFakeDriveFetch();
    try {
      await uploadBackupToDrive("fake-access-token", "pass-phrase");
      expect(capturedRequests.length).toBeGreaterThan(0);
      for (const request of capturedRequests) {
        expectAbsentEverywhere(request.bodyText, request.decodedBase64);
      }
      // Sanity: an upload with the envelope actually happened.
      const upload = capturedRequests.find((request) =>
        request.url.includes("/upload/drive/v3/files"),
      );
      expect(upload).toBeDefined();
      expect(upload!.bodyText).toContain('"format": "ns-backup"');
    } finally {
      await restoreFetch();
    }
  });
});
