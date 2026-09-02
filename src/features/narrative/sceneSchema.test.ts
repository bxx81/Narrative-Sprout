import { describe, test, expect } from "bun:test";
import { z } from "zod";
import {
  narratorSceneResponseSchema,
  cleanJsonSchemaForStructuredOutputs,
  buildSchemaPromptText,
} from "./sceneSchema";

/**
 * Some structured-output providers reject zod v4's `propertyNames` (emitted
 * for key-unbounded records like `notes`) and the top-level `$schema` draft
 * declaration with a 400 bad request — legacy
 * `cleanJsonSchemaForStructuredOutputs` + `removeUnsupported`.
 */
describe("cleanJsonSchemaForStructuredOutputs", () => {
  test("strips propertyNames and $schema from the narrator schema, recursively", () => {
    const raw = z.toJSONSchema(narratorSceneResponseSchema);
    // The preconditions the fix relies on: zod v4 emits both keywords here.
    expect(JSON.stringify(raw)).toContain("propertyNames");
    expect(JSON.stringify(raw)).toContain("$schema");

    const cleaned = cleanJsonSchemaForStructuredOutputs(raw) as Record<string, unknown>;
    expect(JSON.stringify(cleaned)).not.toContain("propertyNames");
    expect(JSON.stringify(cleaned)).not.toContain("$schema");
    expect(cleaned.type).toBe("object");
    // Everything else survives (e.g. the notes description).
    expect(JSON.stringify(cleaned)).toContain("Long-term memory key-value updates");
  });

  test("handles nested objects and arrays", () => {
    const nested = {
      type: "object",
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: {
        plain: { type: "string" },
        list: [{ type: "object", propertyNames: { type: "string" } }],
      },
    };
    const cleaned = cleanJsonSchemaForStructuredOutputs(nested) as {
      properties: { list: Record<string, unknown>[] };
    };
    expect(JSON.stringify(cleaned)).not.toContain("propertyNames");
    expect(JSON.stringify(cleaned)).not.toContain("$schema");
    expect(cleaned.properties.list[0]!.type).toBe("object");
  });

  test("buildSchemaPromptText omits the stripped keywords", () => {
    const text = buildSchemaPromptText(narratorSceneResponseSchema);
    expect(text).not.toContain("propertyNames");
    expect(text).not.toContain("$schema");
  });
});
