import { zip, type Zippable } from "fflate";

/**
 * Wraps fflate's callback-based `zip` in a Promise and returns an
 * `application/zip` Blob. Shared by the ns-save export and the standalone
 * chronicle export, both of which hand-build a `Zippable` map (pre-compressed
 * WebP assets stored with `{ level: 0 }`, text deflated).
 */
export function createZipBlob(files: Zippable): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    zip(files, (error, archive) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(new Blob([archive], { type: "application/zip" }));
    });
  });
}
