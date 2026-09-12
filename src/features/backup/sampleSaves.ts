import { importSaveFromZipBytes, type SaveImportResult } from "./importSave";

/**
 * Bundled sample saves (ns-save format — knowledge/features/story-export.md).
 *
 * The ZIP files live in `public/savedata/` and are served as plain static
 * assets. Because static hosting has no directory listing, the set of
 * samples is declared in `public/savedata/samples.json`: to add, remove or
 * replace samples, drop the ZIPs into that folder and edit the manifest —
 * no code change is needed.
 */

export const SAMPLE_SAVEDATA_DIR = "savedata";
export const SAMPLE_MANIFEST_FILE = "samples.json";

/** Per-request timeout (legacy `loadSampleSavedata` also waited at most 30s). */
const SAMPLE_FETCH_TIMEOUT_MS = 30_000;

export interface SampleImportSummary {
  importedTitles: string[];
  importedGameCount: number;
  importedNodeCount: number;
}

export interface SampleImportOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  importSave?: (zipBytes: Uint8Array) => Promise<SaveImportResult>;
}

function resolveBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

/** `encodeURIComponent` also escapes `/`, so entries cannot escape the dir. */
function sampleFileUrl(fileName: string, baseUrl: string): string {
  return `${baseUrl}${SAMPLE_SAVEDATA_DIR}/${encodeURIComponent(fileName)}`;
}

/**
 * Reads the sample manifest. Entries are validated element-wise (AGENTS.md
 * rule 4): non-string entries are skipped with a warning instead of failing
 * the whole list.
 */
async function fetchSampleFileNames(fetchImpl: typeof fetch, baseUrl: string): Promise<string[]> {
  const response = await fetchImpl(`${baseUrl}${SAMPLE_SAVEDATA_DIR}/${SAMPLE_MANIFEST_FILE}`, {
    signal: AbortSignal.timeout(SAMPLE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Sample list not found (HTTP ${response.status}).`);
  }
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("samples" in body)) {
    throw new Error("Sample list has an unexpected format.");
  }
  const rawSamples = (body as { samples: unknown }).samples;
  if (!Array.isArray(rawSamples)) {
    throw new Error("Sample list has an unexpected format.");
  }
  const fileNames = rawSamples.filter((entry): entry is string => {
    if (typeof entry !== "string" || entry.length === 0) {
      console.warn("[samples] invalid sample entry skipped", entry);
      return false;
    }
    return true;
  });
  if (fileNames.length === 0) {
    throw new Error("Sample list is empty.");
  }
  return fileNames;
}

/**
 * Fetches every bundled sample ZIP and imports it via the regular ns-save
 * path (`importSaveFromZipBytes`, so validation and credential isolation are
 * identical to a user-supplied file). Throws on the first failure, naming
 * the file so the toast tells which sample broke.
 */
export async function importSampleSaves(
  options: SampleImportOptions = {},
): Promise<SampleImportSummary> {
  const {
    fetchImpl = fetch,
    baseUrl = resolveBaseUrl(),
    importSave = importSaveFromZipBytes,
  } = options;
  const fileNames = await fetchSampleFileNames(fetchImpl, baseUrl);
  const importedTitles: string[] = [];
  let importedGameCount = 0;
  let importedNodeCount = 0;
  for (const fileName of fileNames) {
    const response = await fetchImpl(sampleFileUrl(fileName, baseUrl), {
      signal: AbortSignal.timeout(SAMPLE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Sample "${fileName}" could not be loaded (HTTP ${response.status}).`);
    }
    const result = await importSave(new Uint8Array(await response.arrayBuffer()));
    importedTitles.push(result.gameTitle);
    importedGameCount += result.restoredGameCount;
    importedNodeCount += result.restoredNodeCount;
  }
  return { importedTitles, importedGameCount, importedNodeCount };
}
