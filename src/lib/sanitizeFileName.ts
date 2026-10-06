/**
 * Removes characters that are invalid in file names across OSes (and drops
 * control characters). Shared by every download filename builder so the
 * ns-save / ns-chronicle names sanitize identically.
 */
export function sanitizeFileName(title: string): string {
  return [...title.replace(/[<>:"/\\|?*]/g, "")]
    .filter((char) => (char.codePointAt(0) ?? 0) >= 0x20) // drop control characters
    .join("")
    .trim();
}
