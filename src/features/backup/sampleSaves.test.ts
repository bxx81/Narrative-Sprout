import { describe, expect, test } from "bun:test";
import { zip, type Zippable } from "fflate";
import { buildExportBundle } from "../export/exportBundle";
import { gameRepository } from "../../db/gameRepository";
import { importSampleSaves } from "./sampleSaves";
import { makeTestGame, makeTestNode, wipeDatabaseForTest } from "./testsupport/records";

async function buildSampleZipBytes(gameId: string, title: string): Promise<Uint8Array> {
  const game = makeTestGame(gameId, title);
  const bundle = buildExportBundle(game, [makeTestNode(gameId, `${gameId}-node-1`, 1)], []);
  const files: Zippable = {
    "manifest.json": new TextEncoder().encode(JSON.stringify(bundle.manifest)),
  };
  for (const nodeFile of bundle.nodeFiles) {
    files[nodeFile.path] = new TextEncoder().encode(nodeFile.json);
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    zip(files, (error, archive) => (error ? reject(error) : resolve(archive)));
  });
}

interface StubRoute {
  status: number;
  json?: unknown;
  bytes?: Uint8Array;
}

/** Routes by URL suffix; records every requested URL for encoding assertions. */
function stubFetch(routes: Record<string, StubRoute>): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    for (const [suffix, route] of Object.entries(routes)) {
      if (url.endsWith(suffix)) {
        if (route.json !== undefined) {
          return new Response(JSON.stringify(route.json), { status: route.status });
        }
        return new Response(route.bytes as unknown as BodyInit, { status: route.status });
      }
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, urls };
}

describe("bundled sample saves", () => {
  test("imports every sample listed in the manifest", async () => {
    const { fetchImpl } = stubFetch({
      "savedata/samples.json": {
        status: 200,
        json: { samples: ["sample-a.zip", "sample-b.zip"] },
      },
      "sample-a.zip": { status: 200, bytes: await buildSampleZipBytes("game-a", "サンプルA") },
      "sample-b.zip": { status: 200, bytes: await buildSampleZipBytes("game-b", "サンプルB") },
    });
    const summary = await importSampleSaves({ fetchImpl, baseUrl: "/" });
    expect(summary.importedGameCount).toBe(2);
    expect(summary.importedNodeCount).toBe(2);
    expect(summary.importedTitles).toEqual(["サンプルA", "サンプルB"]);

    const games = await gameRepository.listGames();
    expect(games.map((game) => game.title).sort()).toEqual(["サンプルA", "サンプルB"]);
    await wipeDatabaseForTest();
  });

  test("skips invalid manifest entries element-wise", async () => {
    const { fetchImpl, urls } = stubFetch({
      "savedata/samples.json": {
        status: 200,
        json: { samples: [123, "", null, "sample-a.zip"] },
      },
      "sample-a.zip": { status: 200, bytes: await buildSampleZipBytes("game-a", "サンプルA") },
    });
    const summary = await importSampleSaves({ fetchImpl, baseUrl: "/" });
    expect(summary.importedGameCount).toBe(1);
    expect(urls.filter((url) => url.endsWith(".zip"))).toHaveLength(1);
    await wipeDatabaseForTest();
  });

  test("keeps entries inside the sample directory (no path escape)", async () => {
    // "'" is legal in URLs (encodeURIComponent leaves it), but "/" must be
    // escaped so a manifest entry can never climb out of `savedata/`.
    const fileName = "ns-save_alice's_adventures_in_akihabara.zip";
    const { fetchImpl, urls } = stubFetch({
      "savedata/samples.json": { status: 200, json: { samples: [fileName, "../evil.zip"] } },
      ".zip": { status: 200, bytes: await buildSampleZipBytes("game-a", "サンプルA") },
    });
    await importSampleSaves({ fetchImpl, baseUrl: "/" });
    const zipUrls = urls.filter((url) => url.endsWith(".zip"));
    expect(zipUrls).toHaveLength(2);
    for (const url of zipUrls) {
      expect(url.split("/savedata/")[1].includes("/")).toBe(false);
    }
    expect(zipUrls[0].endsWith(`/savedata/${fileName}`)).toBe(true);
    await wipeDatabaseForTest();
  });

  test("throws when the manifest is missing, malformed or empty", async () => {
    const missing = stubFetch({});
    await expect(importSampleSaves({ fetchImpl: missing.fetchImpl, baseUrl: "/" })).rejects.toThrow(
      /Sample list not found/,
    );

    const malformed = stubFetch({
      "savedata/samples.json": { status: 200, json: { samples: "nope" } },
    });
    await expect(
      importSampleSaves({ fetchImpl: malformed.fetchImpl, baseUrl: "/" }),
    ).rejects.toThrow(/unexpected format/);

    const empty = stubFetch({ "savedata/samples.json": { status: 200, json: { samples: [42] } } });
    await expect(importSampleSaves({ fetchImpl: empty.fetchImpl, baseUrl: "/" })).rejects.toThrow(
      /empty/,
    );
    await wipeDatabaseForTest();
  });

  test("throws naming the file when a sample ZIP cannot be loaded", async () => {
    const { fetchImpl } = stubFetch({
      "savedata/samples.json": { status: 200, json: { samples: ["gone.zip"] } },
    });
    await expect(importSampleSaves({ fetchImpl, baseUrl: "/" })).rejects.toThrow(/gone\.zip/);
    await wipeDatabaseForTest();
  });
});
