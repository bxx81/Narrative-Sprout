class ObjectURL implements Disposable {
  url: string;
  constructor(blob: Blob) {
    this.url = URL.createObjectURL(blob);
  }
  [Symbol.dispose]() {
    URL.revokeObjectURL(this.url);
  }
}

/** Triggers a browser download of the given blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  using objectUrl = new ObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl.url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
