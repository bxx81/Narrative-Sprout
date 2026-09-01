import { describe, expect, test } from "bun:test";
import { createFlagMap, resolveConditionalText } from "./conditionalText";

describe("createFlagMap", () => {
  test("maps notes with null as undefined", () => {
    const fm = createFlagMap({ "flag:a": "1", "flag:b": null });
    expect(fm.get("flag:a")).toBe("1");
    expect(fm.get("flag:b")).toBeUndefined();
    expect(fm.has("flag:a")).toBe(true);
    expect(fm.has("flag:b")).toBe(true);
    expect(fm.has("flag:c")).toBe(false);
  });
});

describe("resolveConditionalText", () => {
  const fm = createFlagMap({
    "flag:entered": "true",
    "flag:met_king": "false",
    "flag:zero": "0",
    "status:hero": "running",
    "lore:war": "old",
  });

  test("flag truthy shows inner", () => {
    expect(resolveConditionalText("A <flag:entered>inside</flag:entered> B", fm)).toBe(
      "A inside B",
    );
  });

  test("flag falsy hides inner (false, 0, off, empty)", () => {
    expect(resolveConditionalText("A <flag:met_king>yes</flag:met_king> B", fm)).toBe("A  B");
    expect(resolveConditionalText("A <flag:zero>yes</flag:zero> B", fm)).toBe("A  B");
    expect(resolveConditionalText("A <flag:missing>yes</flag:missing> B", fm)).toBe("A  B");
  });

  test("flag-not inverts", () => {
    expect(resolveConditionalText("X <flag-not:met_king>shown</flag-not:met_king> Y", fm)).toBe(
      "X shown Y",
    );
    expect(resolveConditionalText("X <flag-not:entered>shown</flag-not:entered> Y", fm)).toBe(
      "X  Y",
    );
  });

  test("if exact match", () => {
    expect(
      resolveConditionalText("X <if:status:hero=running>run</if:status:hero=running> Y", fm),
    ).toBe("X run Y");
    expect(
      resolveConditionalText("X <if:status:hero=walking>run</if:status:hero=walking> Y", fm),
    ).toBe("X  Y");
  });

  test("if-not exact not equal", () => {
    expect(
      resolveConditionalText(
        "X <if-not:status:hero=running>not</if-not:status:hero=running> Y",
        fm,
      ),
    ).toBe("X  Y");
    expect(
      resolveConditionalText(
        "X <if-not:status:hero=walking>not</if-not:status:hero=walking> Y",
        fm,
      ),
    ).toBe("X not Y");
  });

  test("nested blocks", () => {
    expect(
      resolveConditionalText("<flag:entered>A<flag:entered>B</flag:entered>C</flag:entered>", fm),
    ).toBe("ABC");
    expect(
      resolveConditionalText(
        "<flag:entered>outer <flag:met_king>inner</flag:met_king> end</flag:entered>",
        fm,
      ),
    ).toBe("outer  end");
  });

  test("missing close tag returns source unchanged", () => {
    expect(resolveConditionalText("<flag:entered>oops", fm)).toBe("<flag:entered>oops");
  });

  test("case-insensitive falsy values", () => {
    const fm2 = createFlagMap({ "flag:x": "False", "flag:y": "NO", "flag:z": "OFF" });
    expect(resolveConditionalText("<flag:x>yes</flag:x>", fm2)).toBe("");
    expect(resolveConditionalText("<flag:y>yes</flag:y>", fm2)).toBe("");
    expect(resolveConditionalText("<flag:z>yes</flag:z>", fm2)).toBe("");
  });

  test("multiple distinct flags in one string", () => {
    const text = "<flag:entered>A</flag:entered> and <flag:met_king>B</flag:met_king>";
    expect(resolveConditionalText(text, fm)).toBe("A and ");
  });
});
