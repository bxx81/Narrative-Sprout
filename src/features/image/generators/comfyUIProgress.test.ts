import { describe, expect, test } from "bun:test";
import { ComfyUIProgressTracker } from "./comfyUIProgress";

function createTracker(workflow: unknown): {
  tracker: ComfyUIProgressTracker;
  reported: number[];
} {
  const reported: number[] = [];
  const tracker = new ComfyUIProgressTracker(workflow, (progress) => reported.push(progress));
  return { tracker, reported };
}

describe("ComfyUIProgressTracker", () => {
  test("scales a single sampler's steps across the whole workflow", () => {
    const { tracker, reported } = createTracker({
      "10": { class_type: "KSampler", inputs: { steps: 10, denoise: 1 } },
    });

    tracker.onExecutingNode("10");
    tracker.onNodeProgress("10", 4, 10);

    expect(tracker.progress).toBeCloseTo(0.4);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toBeCloseTo(0.4);
  });

  test("keeps progressing across two samplers instead of restarting at zero", () => {
    const { tracker, reported } = createTracker({
      "1": { class_type: "CheckpointLoaderSimple", inputs: {} },
      "2": { class_type: "KSampler", inputs: { steps: 10, denoise: 1 } },
      "3": { class_type: "KSampler", inputs: { steps: 10, denoise: 0.5 } },
    });

    tracker.onExecutingNode("1");
    tracker.onExecutingNode("2");
    expect(tracker.progress).toBeCloseTo(1 / 16);

    tracker.onNodeProgress("2", 10, 10);
    expect(tracker.progress).toBeCloseTo(11 / 16);

    tracker.onExecutingNode("3");
    expect(tracker.progress).toBeCloseTo(11 / 16);

    tracker.onNodeProgress("3", 5, 5);
    expect(tracker.progress).toBeCloseTo(0.99);
    expect(reported).toEqual([...reported].sort((a, b) => a - b));
    expect(reported.at(-1)).toBeCloseTo(0.99);
  });

  test("removes cached nodes from the total weight", () => {
    const { tracker } = createTracker({
      "1": { class_type: "CheckpointLoaderSimple", inputs: {} },
      "2": { class_type: "KSampler", inputs: { steps: 10 } },
    });

    tracker.onCachedNodeIds(["1"]);
    tracker.onExecutingNode("2");
    tracker.onNodeProgress("2", 5, 10);

    expect(tracker.progress).toBeCloseTo(0.5);
  });

  test("uses steps from a linked scheduler for SamplerCustomAdvanced", () => {
    const { tracker } = createTracker({
      "1": { class_type: "BasicScheduler", inputs: { steps: 8 } },
      "2": { class_type: "SamplerCustomAdvanced", inputs: { sigmas: ["1", 0] } },
    });

    tracker.onExecutingNode("1");
    tracker.onExecutingNode("2");
    tracker.onNodeProgress("2", 4, 8);

    expect(tracker.progress).toBeCloseTo(5 / 9);
  });

  test("never reports a lower progress than before", () => {
    const { tracker } = createTracker({
      "1": { class_type: "KSampler", inputs: { steps: 10 } },
    });

    tracker.onExecutingNode("1");
    tracker.onNodeProgress("1", 6, 10);
    tracker.onNodeProgress("1", 2, 10);

    expect(tracker.progress).toBeCloseTo(0.6);
  });

  test("falls back to the raw fraction when the node is unknown", () => {
    const { tracker } = createTracker({
      "1": { class_type: "KSampler", inputs: { steps: 10 } },
    });

    tracker.onNodeProgress(null, 3, 10);
    tracker.onNodeProgress(null, 7, 10);

    expect(tracker.progress).toBeCloseTo(0.7);
  });
});
