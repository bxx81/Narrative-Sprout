const DEFAULT_NODE_WEIGHT = 1;
const MAX_EXECUTION_PROGRESS = 0.99;
const SAMPLER_CLASS_PATTERN = /sampl/i;

interface ComfyUIWorkflowNode {
  classType: string;
  inputs: Record<string, unknown>;
}

export class ComfyUIProgressTracker {
  private readonly nodeWeights: ReadonlyMap<string, number>;
  private readonly onProgress: (progress: number) => void;
  private readonly cachedNodeIds = new Set<string>();
  private readonly completedNodeIds = new Set<string>();
  private currentNodeId: string | null = null;
  private currentFraction = 0;
  private lastProgress = 0;

  constructor(workflow: unknown, onProgress: (progress: number) => void) {
    this.nodeWeights = buildNodeWeights(workflow);
    this.onProgress = onProgress;
  }

  get progress(): number {
    return this.lastProgress;
  }

  onCachedNodeIds(nodeIds: readonly unknown[]): void {
    for (const nodeId of nodeIds) {
      const key = toNodeId(nodeId);
      if (key === null || !this.nodeWeights.has(key)) continue;
      this.cachedNodeIds.add(key);
      if (this.currentNodeId === key) {
        this.currentNodeId = null;
        this.currentFraction = 0;
      }
    }
  }

  onExecutingNode(nodeId: string | null): void {
    if (nodeId === this.currentNodeId) return;
    this.completeCurrentNode();
    this.currentNodeId = nodeId;
    this.currentFraction = 0;
    this.updateFromNodes();
  }

  onNodeProgress(nodeId: string | null, value: number, max: number): void {
    if (nodeId !== null && nodeId !== this.currentNodeId) {
      this.completeCurrentNode();
      this.currentNodeId = nodeId;
      this.currentFraction = 0;
    }
    if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return;
    const fraction = clampFraction(value / max);
    if (this.currentNodeId === null) {
      this.report(fraction);
      return;
    }
    this.currentFraction = fraction;
    this.updateFromNodes();
  }

  private completeCurrentNode(): void {
    if (this.currentNodeId !== null && !this.cachedNodeIds.has(this.currentNodeId)) {
      this.completedNodeIds.add(this.currentNodeId);
    }
    this.currentNodeId = null;
    this.currentFraction = 0;
  }

  private totalWeight(): number {
    let total = 0;
    for (const [nodeId, weight] of this.nodeWeights) {
      if (!this.cachedNodeIds.has(nodeId)) total += weight;
    }
    return total;
  }

  private updateFromNodes(): void {
    const totalWeight = this.totalWeight();
    if (totalWeight <= 0) {
      this.report(this.currentFraction);
      return;
    }
    let completedWeight = 0;
    for (const nodeId of this.completedNodeIds) {
      if (this.cachedNodeIds.has(nodeId)) continue;
      completedWeight += this.nodeWeights.get(nodeId) ?? 0;
    }
    let currentWeight = 0;
    if (this.currentNodeId !== null && !this.completedNodeIds.has(this.currentNodeId)) {
      currentWeight = this.nodeWeights.get(this.currentNodeId) ?? 0;
    }
    this.report((completedWeight + currentWeight * this.currentFraction) / totalWeight);
  }

  private report(rawProgress: number): void {
    const next = Math.min(MAX_EXECUTION_PROGRESS, Math.max(this.lastProgress, rawProgress));
    if (next <= this.lastProgress) return;
    this.lastProgress = next;
    this.onProgress(next);
  }
}

function buildNodeWeights(workflow: unknown): ReadonlyMap<string, number> {
  const nodes = readWorkflowNodes(workflow);
  const weights = new Map<string, number>();
  for (const [nodeId, node] of nodes) {
    weights.set(nodeId, weightForNode(node, nodes));
  }
  return weights;
}

function readWorkflowNodes(workflow: unknown): ReadonlyMap<string, ComfyUIWorkflowNode> {
  const nodes = new Map<string, ComfyUIWorkflowNode>();
  if (!isRecord(workflow)) return nodes;
  for (const [nodeId, rawNode] of Object.entries(workflow)) {
    if (!isRecord(rawNode)) continue;
    const classType = typeof rawNode["class_type"] === "string" ? rawNode["class_type"] : "";
    const inputs = isRecord(rawNode["inputs"]) ? rawNode["inputs"] : {};
    nodes.set(nodeId, { classType, inputs });
  }
  return nodes;
}

function weightForNode(
  node: ComfyUIWorkflowNode,
  allNodes: ReadonlyMap<string, ComfyUIWorkflowNode>,
): number {
  if (!SAMPLER_CLASS_PATTERN.test(node.classType)) return DEFAULT_NODE_WEIGHT;
  const ownSteps = readSteps(node.inputs);
  if (ownSteps !== null) return ownSteps * readDenoise(node.inputs);
  const linkedSteps = readLinkedSteps(node.inputs, allNodes);
  return linkedSteps > 0 ? linkedSteps : DEFAULT_NODE_WEIGHT;
}

function readLinkedSteps(
  inputs: Record<string, unknown>,
  allNodes: ReadonlyMap<string, ComfyUIWorkflowNode>,
): number {
  let maxSteps = 0;
  for (const inputValue of Object.values(inputs)) {
    const linkedNodeId = readLinkTarget(inputValue);
    if (linkedNodeId === null) continue;
    const linkedNode = allNodes.get(linkedNodeId);
    if (!linkedNode) continue;
    const steps = readSteps(linkedNode.inputs);
    if (steps !== null && steps > maxSteps) maxSteps = steps;
  }
  return maxSteps;
}

function readSteps(inputs: Record<string, unknown>): number | null {
  const steps = inputs["steps"];
  return typeof steps === "number" && Number.isFinite(steps) && steps > 0 ? steps : null;
}

function readDenoise(inputs: Record<string, unknown>): number {
  const denoise = inputs["denoise"];
  return typeof denoise === "number" && Number.isFinite(denoise) && denoise > 0 && denoise <= 1
    ? denoise
    : 1;
}

function readLinkTarget(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return toNodeId(value[0]);
}

function toNodeId(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function clampFraction(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
