/**
 * Minimal Google Drive v3 REST client (fetch + bearer token).
 *
 * Only the operations the backup feature needs: folder get-or-create,
 * multipart upload, list, download, delete. No `gapi-script` dependency.
 * The client is created per call with the in-memory access token.
 */

export interface DriveFileMetadata {
  fileId: string;
  name: string;
  /** null when Drive does not report a size (e.g. folders). */
  sizeBytes: number | null;
  /** ISO 8601, or null when unknown. */
  modifiedAt: string | null;
}

export class DriveApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "DriveApiError";
    this.status = status;
  }
}

/** Thrown on HTTP 401 so callers can drop the stale token and re-connect. */
export class DriveUnauthorizedError extends DriveApiError {
  constructor(options?: ErrorOptions) {
    super("Google Drive session expired. Please connect again.", 401, options);
    this.name = "DriveUnauthorizedError";
  }
}

/** Minimal fetch shape so tests can inject a fake (Bun's fetch has extra members). */
export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

export interface DriveClient {
  findFolderByName(name: string): Promise<DriveFileMetadata | null>;
  createFolder(name: string): Promise<DriveFileMetadata>;
  getOrCreateFolder(name: string): Promise<DriveFileMetadata>;
  uploadFile(
    blob: Blob,
    fileName: string,
    folderId: string,
    options?: { overwrite?: boolean },
  ): Promise<DriveFileMetadata>;
  listFilesInFolder(folderId: string): Promise<DriveFileMetadata[]>;
  downloadFile(fileId: string): Promise<Blob>;
  deleteFile(fileId: string): Promise<void>;
}

/** Escapes a value embedded into a Drive search query (quotes/backslashes). */
function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function createDriveClient(
  accessToken: string,
  fetchImpl: FetchImpl = (...args) => globalThis.fetch(...args),
): DriveClient {
  async function driveFetch(
    path: string,
    init: RequestInit = {},
    options: { upload?: boolean } = {},
  ): Promise<Response> {
    const base = options.upload ? UPLOAD_API_BASE : DRIVE_API_BASE;
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    });
    if (response.status === 401) throw new DriveUnauthorizedError();
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      throw new DriveApiError(
        `Google Drive request failed (${response.status} ${response.statusText}).`,
        response.status,
        { cause: bodyText },
      );
    }
    return response;
  }

  function toMetadata(rawFile: {
    id?: string;
    name?: string;
    size?: string;
    modifiedTime?: string;
  }): DriveFileMetadata {
    return {
      fileId: rawFile.id ?? "",
      name: rawFile.name ?? "",
      sizeBytes: rawFile.size !== undefined ? Number(rawFile.size) : null,
      modifiedAt: rawFile.modifiedTime ?? null,
    };
  }

  async function findFolderByName(name: string): Promise<DriveFileMetadata | null> {
    const query = `mimeType='${FOLDER_MIME_TYPE}' and name='${escapeDriveQueryValue(name)}' and trashed=false`;
    const response = await driveFetch(
      `/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id,name)")}&spaces=drive&pageSize=10`,
    );
    const result = (await response.json()) as { files?: Array<{ id?: string; name?: string }> };
    const first = result.files?.[0];
    return first?.id ? toMetadata(first) : null;
  }

  async function createFolder(name: string): Promise<DriveFileMetadata> {
    const response = await driveFetch("/files?fields=id,name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE }),
    });
    return toMetadata((await response.json()) as { id?: string; name?: string });
  }

  async function uploadFile(
    blob: Blob,
    fileName: string,
    folderId: string,
    options: { overwrite?: boolean } = {},
  ): Promise<DriveFileMetadata> {
    let existingFileId: string | null = null;
    if (options.overwrite) {
      const query = `name='${escapeDriveQueryValue(fileName)}' and '${escapeDriveQueryValue(folderId)}' in parents and trashed=false`;
      const searchResponse = await driveFetch(
        `/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id)")}&spaces=drive&pageSize=1`,
      );
      const searchResult = (await searchResponse.json()) as { files?: Array<{ id?: string }> };
      existingFileId = searchResult.files?.[0]?.id ?? null;
    }

    const boundary = `nsbackup-${crypto.randomUUID().replaceAll("-", "")}`;
    const metadataPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(
        existingFileId ? { name: fileName } : { name: fileName, parents: [folderId] },
      ) +
      "\r\n";
    const mediaPart = `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const closingPart = `\r\n--${boundary}--`;
    const body = new Blob([metadataPart, mediaPart, blob, closingPart], {
      type: `multipart/related; boundary=${boundary}`,
    });

    // Path is relative to the upload base (https://www.googleapis.com/upload/drive/v3).
    const path = existingFileId
      ? `/files/${existingFileId}?uploadType=multipart&fields=id,name`
      : `/files?uploadType=multipart&fields=id,name`;

    const response = await driveFetch(
      path,
      {
        method: existingFileId ? "PATCH" : "POST",
        body,
      },
      { upload: true },
    );
    return toMetadata((await response.json()) as { id?: string; name?: string });
  }

  return {
    findFolderByName,
    createFolder,
    async getOrCreateFolder(name) {
      const existing = await findFolderByName(name);
      return existing ?? (await createFolder(name));
    },
    uploadFile,
    async listFilesInFolder(folderId) {
      const allFiles: DriveFileMetadata[] = [];
      let pageToken: string | undefined;
      do {
        const query = `'${escapeDriveQueryValue(folderId)}' in parents and trashed=false`;
        const params = new URLSearchParams({
          q: query,
          fields: "nextPageToken, files(id,name,size,modifiedTime)",
          spaces: "drive",
          pageSize: "200",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const response = await driveFetch(`/files?${params.toString()}`);
        const result = (await response.json()) as {
          files?: Array<{ id?: string; name?: string; size?: string; modifiedTime?: string }>;
          nextPageToken?: string;
        };
        for (const rawFile of result.files ?? []) allFiles.push(toMetadata(rawFile));
        pageToken = result.nextPageToken;
      } while (pageToken);
      return allFiles;
    },
    async downloadFile(fileId) {
      const response = await driveFetch(`/files/${encodeURIComponent(fileId)}?alt=media`);
      return response.blob();
    },
    async deleteFile(fileId) {
      await driveFetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
    },
  };
}
