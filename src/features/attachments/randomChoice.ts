/**
 * Random choice placeholder processor.
 *
 * Supports `{option1|option2|...}` (nested) and exception pattern
 * `{##marker##|opt1|opt2}` where the marker `##marker##` is later replaced
 * by a random insertion of the options into the text split by the marker.
 *
 * Ported from legacy `promptService.ts#processRandomChoice` with same
 * semantics to preserve authoring compatibility.
 */

function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = array[i]!;
    array[i] = array[j]!;
    array[j] = tmp;
  }
  return array;
}

function insertRandomly(a: string[], b: string[]): string[] {
  const n = a.length;
  const m = b.length;
  const shuffledB = fisherYatesShuffle([...b]);
  if (m > n - 1) shuffledB.length = n - 1;
  const result: string[] = [];
  let bIndex = 0;
  for (let i = 0; i < n; i++) {
    result.push(a[i]!);
    if (i < n - 1) {
      const remainingGaps = n - 1 - i;
      const remainingB = shuffledB.length - bIndex;
      if (Math.random() < remainingB / remainingGaps) {
        result.push(shuffledB[bIndex]!);
        bIndex++;
      }
    }
  }
  return result;
}

/**
 * Resolves `{a|b}` placeholders and `##marker##` random-insertion patterns.
 */
export function processRandomChoice(text: string): string {
  const regex = /\{([^{}]*?)\}/g;
  const exception: Record<string, string[]> = {};
  let result = text;
  let previous: string;
  do {
    previous = result;
    result = result.replace(regex, (match, content: string) => {
      const options: string[] = content.split("|").map((s: string) => s.trim());
      if (options.length === 0 || options[0] === "") return match;
      if (options.length > 1 && options[0]?.startsWith("##") && options[0]?.endsWith("##")) {
        const word = options[0]!;
        options.shift();
        exception[word] = options;
        return "";
      }
      const idx = Math.floor(Math.random() * options.length);
      return options[idx] ?? "";
    });
  } while (result !== previous);

  for (const key in exception) {
    try {
      const splitContent = result.split(key);
      const mixContent = insertRandomly(splitContent, exception[key]!);
      result = mixContent.join("");
    } catch (e: unknown) {
      if ((e as Error)?.name !== "Error") throw e;
      throw new Error("Syntax error: number of elements " + key);
    }
  }
  return result;
}
