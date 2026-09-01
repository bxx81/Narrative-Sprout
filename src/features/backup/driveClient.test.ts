import { afterEach, describe, expect, test } from "bun:test";
import { createDriveClient, DriveUnauthorizedError, type FetchImpl } from "./driveClient";
import { uploadBackupToDrive, listDriveBackups, deleteDriveBackup } from "./driveBackup";
import { wipeDatabaseForTest } from "./testsupport/records";

interface CapturedRequest {
  url: string;
  method: string;
  bodyText: string;
}

function createFakeDriveFetch(options: {
  status?: number;
  folders?: Array<{ id: string; name: string }>;
  files?: Array<{ id: string; name: string; size?: string; modifiedTime?: string }>;
}) {
  const requests: CapturedRequest[] = [];
  const fetchImpl: FetchImpl = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? "GET";
    const body = init?.body;
    let bodyText = "";
    if (body instanceof Blob) bodyText = Buffer.from(await body.arrayBuffer()).toString("latin1");
    else if (typeof body === "string") bodyText = body;
    requests.push({ url, method, bodyText });

    if (options.status !== undefined) {
      return new Response("error body", { status: options.status });
    }
    const json = (payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    if (url.includes("/drive/v3/files?") && url.includes("q=")) {
      const isFolderQuery = url.includes("google-apps.folder");
      const matches = isFolderQuery ? (options.folders ?? []) : (options.files ?? []);
      return json({ files: matches });
    }
    if (url.includes("alt=media")) {
      return new Response("FILEBYTES", { status: 200 });
    }
    if (url.includes("/drive/v3/files?") || url.includes("/drive/v3/files/")) {
      if (method === "DELETE") return new Response(null, { status: 204 });
      const requestedName = bodyText.match(/"name":"([^"]+)"/)?.[1] ?? "created";
      return json({ id: "new-id", name: requestedName });
    }
    if (url.includes("/upload/drive/v3/files")) {
      const requestedName = bodyText.match(/"name":"([^"]+)"/)?.[1] ?? "uploaded";
      return json({ id: "uploaded-id", name: requestedName });
    }
    return new Response("unexpected", { status: 404 });
  };
  return { fetchImpl, requests };
}

afterEach(wipeDatabaseForTest);

describe("createDriveClient", () => {
  test("getOrCreateFolder creates when missing", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({ folders: [] });
    const client = createDriveClient("token-1", fetchImpl);
    const folder = await client.getOrCreateFolder("NarrativeSproutBackup");
    expect(folder.fileId).toBe("new-id");
    expect(requests.some((r) => r.method === "POST")).toBe(true);
  });

  test("getOrCreateFolder reuses an existing folder", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({
      folders: [{ id: "folder-9", name: "NarrativeSproutBackup" }],
    });
    const client = createDriveClient("token-1", fetchImpl);
    const folder = await client.getOrCreateFolder("NarrativeSproutBackup");
    expect(folder.fileId).toBe("folder-9");
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  test("uploadFile sends a multipart body with metadata and bytes", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({});
    const client = createDriveClient("token-1", fetchImpl);
    const payload = new Blob([new TextEncoder().encode("ENVELOPE-JSON-HERE")], {
      type: "application/json",
    });
    await client.uploadFile(payload, "ns-backup_x.nsbak", "folder-1");

    const upload = requests.find((r) => r.url.includes("/upload/drive/v3/files"));
    expect(upload).toBeDefined();
    // Exact URL: guards against a doubled base like /upload/drive/v3/upload/drive/v3/files.
    expect(upload!.url).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    );
    expect(upload!.method).toBe("POST");
    expect(upload!.bodyText).toContain("ENVELOPE-JSON-HERE");
    expect(upload!.bodyText).toContain('"name":"ns-backup_x.nsbak"');
    expect(upload!.bodyText).toContain('"parents":["folder-1"]');
  });

  test("uploadFile overwrites an existing file via PATCH", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({
      files: [{ id: "existing-1", name: "ns-backup_x.nsbak" }],
    });
    const client = createDriveClient("token-1", fetchImpl);
    await client.uploadFile(new Blob(["x"]), "ns-backup_x.nsbak", "folder-1", { overwrite: true });

    const upload = requests.find((r) => r.url.includes("/upload/drive/v3/files"));
    expect(upload!.method).toBe("PATCH");
    expect(upload!.url).toBe(
      "https://www.googleapis.com/upload/drive/v3/files/existing-1?uploadType=multipart&fields=id,name",
    );
    expect(upload!.bodyText).not.toContain('"parents"');
  });

  test("listFilesInFolder aggregates and downloadFile returns bytes", async () => {
    const { fetchImpl } = createFakeDriveFetch({
      files: [{ id: "file-1", name: "a.nsbak", size: "12", modifiedTime: "2026-09-01T00:00:00Z" }],
    });
    const client = createDriveClient("token-1", fetchImpl);
    const files = await client.listFilesInFolder("folder-1");
    expect(files).toEqual([
      { fileId: "file-1", name: "a.nsbak", sizeBytes: 12, modifiedAt: "2026-09-01T00:00:00Z" },
    ]);

    const blob = await client.downloadFile("file-1");
    expect(await blob.text()).toBe("FILEBYTES");
  });

  test("deleteFile issues DELETE", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({});
    const client = createDriveClient("token-1", fetchImpl);
    await client.deleteFile("file-1");
    expect(requests.some((r) => r.method === "DELETE" && r.url.includes("/files/file-1"))).toBe(
      true,
    );
  });

  test("401 responses raise DriveUnauthorizedError", async () => {
    const { fetchImpl } = createFakeDriveFetch({ status: 401 });
    const client = createDriveClient("stale-token", fetchImpl);
    await expect(client.listFilesInFolder("folder-1")).rejects.toBeInstanceOf(
      DriveUnauthorizedError,
    );
  });
});

describe("driveBackup orchestration", () => {
  test("upload creates the folder, uploads a ns-backup envelope and lists it back", async () => {
    let folderExists = false;
    let uploadedName = "";
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const json = (payload: unknown) =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      if (
        url.includes("/drive/v3/files?") &&
        url.includes("q=") &&
        url.includes("google-apps.folder")
      ) {
        return json({
          files: folderExists ? [{ id: "folder-1", name: "NarrativeSproutBackup" }] : [],
        });
      }
      if (url.includes("/drive/v3/files?fields=id,name") && init?.method === "POST") {
        folderExists = true;
        return json({ id: "folder-1", name: "NarrativeSproutBackup" }); // create folder
      }
      if (url.includes("/upload/drive/v3/files")) {
        const bodyText = Buffer.from(await (init!.body as Blob).arrayBuffer()).toString("latin1");
        uploadedName = bodyText.match(/"name":"([^"]+)"/)?.[1] ?? "";
        folderExists = true;
        return json({ id: "uploaded-1", name: uploadedName });
      }
      if (url.includes("/drive/v3/files?") && url.includes("q=")) {
        return json({
          files: [
            {
              id: "uploaded-1",
              name: uploadedName,
              size: "10",
              modifiedTime: "2026-09-01T01:00:00Z",
            },
          ],
        });
      }
      return new Response("unexpected", { status: 404 });
    };

    const { fileName } = await uploadBackupToDrive("token-1", "pass-phrase", fetchImpl);
    expect(fileName.startsWith("ns-backup_")).toBe(true);
    expect(uploadedName).toBe(fileName);

    const backups = await listDriveBackups("token-1", fetchImpl);
    expect(backups[0]?.name).toBe(uploadedName);
    expect(backups[0]?.fileId).toBe("uploaded-1");
    expect(uploadedName.endsWith(".nsbak")).toBe(true);
  });

  test("listDriveBackups returns [] when the folder does not exist yet", async () => {
    const { fetchImpl } = createFakeDriveFetch({ folders: [] });
    expect(await listDriveBackups("token-1", fetchImpl)).toEqual([]);
  });

  test("deleteDriveBackup calls through", async () => {
    const { fetchImpl, requests } = createFakeDriveFetch({});
    await deleteDriveBackup("token-1", "file-1", fetchImpl);
    expect(requests.some((r) => r.method === "DELETE")).toBe(true);
  });
});
