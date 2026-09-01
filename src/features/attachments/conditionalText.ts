/**
 * Conditional text resolver for attachment contents (REDESIGN.md §4.4 / §6).
 *
 * Supports:
 * - `<flag:NAME>…</flag:NAME>`          flag truthy
 * - `<flag-not:NAME>…</flag-not:NAME>`  flag falsy / missing
 * - `<if:KEY=VALUE>…</if:KEY=VALUE>`     exact match
 * - `<if-not:KEY=VALUE>…</if-not:KEY=VALUE>`  not equal
 *
 * Flags are sourced from `MemoryState.notes`. `flag:` tags are implicitly
 * prefixed with `flag:` to match the AI's memory key convention.
 * Nested tags are supported.
 */

export type Notes = Record<string, string | null>;

export interface FlagMap {
  has: (name: string) => boolean;
  get: (name: string) => string | undefined;
}

export function createFlagMap(notes: Notes): FlagMap {
  return {
    has: (name: string): boolean => name in notes,
    get: (name: string): string | undefined =>
      notes[name] === null ? undefined : (notes[name] as string | undefined),
  };
}

const FALSY_VALUES = new Set(["false", "0", "no", "off", ""]);

function isTruthy(value: string | undefined): boolean {
  if (value === undefined) return false;
  return !FALSY_VALUES.has(value.toLowerCase());
}

type BlockKind = "flag" | "flag-not" | "if" | "if-not";

const OPEN_TAG = /<(flag|flag-not|if|if-not):[^>]*?>/;

export function resolveConditionalText(source: string, flags: FlagMap): string {
  return parseBlock(source, flags);
}

function parseBlock(source: string, flags: FlagMap): string {
  const open = OPEN_TAG.exec(source);
  if (!open) return source;

  const full = open[0];
  const kind = full.slice(1, full.indexOf(":")) as BlockKind;
  const spec = full.slice(full.indexOf(":") + 1, -1);

  const openStart = open.index;
  const contentStart = openStart + full.length;
  const content = source.slice(contentStart);

  const closeIndex = findMatchingClose(content, kind, spec);
  if (closeIndex === -1) return source;

  const inner = content.slice(0, closeIndex);
  const keptInner = evaluateBlock(kind, spec, flags) ? parseBlock(inner, flags) : "";

  const after = content.slice(closeIndex + closeTagLength(kind, spec));
  const next = source.slice(0, openStart) + keptInner + after;
  return parseBlock(next, flags);
}

function closeTagLength(kind: BlockKind, spec: string): number {
  return `</${kind}:${spec}>`.length;
}

function findMatchingClose(content: string, kind: BlockKind, spec: string): number {
  const closeTag = `</${kind}:${spec}>`;
  const openTag = `<${kind}:${spec}>`;
  let depth = 1;
  let i = 0;
  for (;;) {
    const nextOpen = content.indexOf(openTag, i);
    const nextClose = content.indexOf(closeTag, i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + openTag.length;
    } else {
      depth -= 1;
      if (depth === 0) return nextClose;
      i = nextClose + closeTag.length;
    }
  }
}

function evaluateBlock(kind: BlockKind, spec: string, flags: FlagMap): boolean {
  const eqIndex = spec.indexOf("=");
  const rawName = eqIndex >= 0 ? spec.slice(0, eqIndex).trim() : spec.trim();
  const expected = eqIndex >= 0 ? spec.slice(eqIndex + 1) : undefined;
  const name = kind === "flag" || kind === "flag-not" ? `flag:${rawName}` : rawName;
  const value = flags.get(name);
  switch (kind) {
    case "flag":
      return isTruthy(value);
    case "flag-not":
      return !isTruthy(value);
    case "if":
      return value === expected;
    case "if-not":
      return value !== expected;
  }
}
