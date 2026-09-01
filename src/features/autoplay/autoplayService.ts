import { z } from "zod";
import { OpenAiCompatibleClient } from "../../lib/openAiClient";
import { parseTextModelOptions } from "../../lib/modelOptions";
import type { GameRecord, StoryNodeRecord } from "../../types";

/*
  Auto-play overview (legacy computerPlayerService, translated to the v2
  record shapes): a separate "player AI" compiles the whole playthrough up to
  the viewed node into one text log and answers with the next player action.
  The returned reasoning is persisted on the produced node
  (metadata.autoplayReasoning) so the reasoning chain survives save/reload
  and is re-derived from the tree on every subsequent decision.
*/

function buildSystemPrompt(language: string, isStoryOver: boolean): string {
  return (
    `# Role
This is the auto-play feature of Narrative Sprout, an AI-driven visual novel game.
Your role is to act as a player: analyze the current state of the game and generate the next action on the player's behalf.
You MUST return your response as a JSON object matching the required schema.

## Game Log Field Descriptions

* \`Theme\`: A summary of the settings used to generate the current game. Additional details may exist beyond this summary, and the player is assumed not to know them in advance — you should discover that information through gameplay, just as a real player would.
* \`Scene text\`: The narrative text presented to the player.
* \`Choices\`: Three choices prepared by the game. You may pick one and copy it verbatim, or write a free-form response instead.
* \`Player's choice\`: The action the player actually took — either one of the provided choices or a free-form response. The subsequent Scene text is generated based on this choice.

## Game System Overview

The game ends when the story AI determines the narrative has reached a natural stopping point.
From the player's perspective, the goal is to gather information, accomplish the objectives implied by the setting, and guide the story toward its conclusion.
That said, how you play is entirely up to you — you can enjoy the world-building, go off on tangents, or anything in between.
In most cases, typing something like "→ [X] ending" as a free-form response will cause the game to end on that note in the next turn.

` +
    (isStoryOver
      ? `## Fields You Must Generate

* \`reasoning\`: A free-form memo field for your own use. It has no effect on the game. **The story has reached its ending — please write a retrospective comment on the overall playthrough in the specified language.**

`
      : `## Fields You Must Generate

* \`reasoning\`: A free-form memo field for your own use. It has no effect on the game. Write key takeaways from the scene, your planned direction, or any notes you find useful. This data is saved as part of the game log and will be shown to you in subsequent turns.
* \`choice\`: The action to take next. This will be treated as the \`Player's choice\` in the next turn.

## Play Guidelines

You are free to decide how to act during the game, but **always prioritize staying in character**. Specifically, actions that break immersion — such as seeking out a character the protagonist has no way of knowing — are not appropriate.

In general, the following types of actions move the story forward:

* **Gather information**: Investigate or question NPCs to fill in gaps left by the scene text. In meta terms, this either surfaces existing setting details or causes the AI to generate and commit to new ones.
* **Move or travel**: Trigger events by going somewhere or visiting someone.
* **Advance time**: When timing matters, specify a time skip (e.g., "The next morning, I head out as usual"). Avoid extreme jumps (e.g., "10 years later") that would render the setting moot.
* **Take action**: Perform concrete actions that set story flags (e.g., "Pick up the key lying on the ground").

`) +
    `## Settings

Language: ${language}

`
  );
}

const autoplayDecisionSchema = z.object({
  reasoning: z.string(),
  choice: z.string(),
});

const autoplayEndingSchema = z.object({
  reasoning: z.string(),
});

interface AutoplayLogEntry {
  sceneText: string;
  choices: string[];
  choiceText: string | null;
  autoplayReasoning: string | null;
  isStoryOver: boolean;
  storyClosingText: string;
}

/**
 * Walks the parent chain from the viewed node to the root and compiles the
 * full playthrough text log (theme, scenes, choices, reasoning chain).
 * Pure function so the store test can drive it directly.
 */
export function buildAutoplayLog(
  game: GameRecord,
  nodes: StoryNodeRecord[],
  viewingNodeId: string,
): { text: string; isStoryOver: boolean } {
  const byId = new Map<string, StoryNodeRecord>(nodes.map((node) => [node.id as string, node]));
  const logs: AutoplayLogEntry[] = [];
  let cursorId: string | null = viewingNodeId;
  let isStoryOver = false;
  while (cursorId !== null) {
    const node = byId.get(cursorId);
    if (!node) break;
    if (cursorId === viewingNodeId) {
      isStoryOver = node.scene.isStoryOver;
    }
    logs.unshift({
      sceneText: node.scene.sceneText,
      choices: node.scene.choices,
      choiceText: node.choiceText,
      autoplayReasoning: node.metadata.autoplayReasoning ?? null,
      isStoryOver: node.scene.isStoryOver,
      storyClosingText: node.scene.storyClosingText,
    });
    cursorId = node.parentNodeId;
  }

  let text = `## Theme\n\n${game.title}\n\n`;
  logs.forEach((log, index) => {
    const turnNumber = index + 1;
    if (turnNumber > 1) {
      if (log.autoplayReasoning) {
        text += `## Reasoning\n\n${log.autoplayReasoning}\n\n`;
      }
      text += `## Player's choice\n\n${log.choiceText ?? ""}\n\n`;
    }
    text += `## Scene text: Turn ${turnNumber}\n\n${log.sceneText}\n\n`;
    if (log.isStoryOver) {
      text += `## Story closing text\n\n${log.storyClosingText}\n\n`;
    } else {
      text += `## Choices\n\n${log.choices.map((choice) => "* " + choice).join("\n")}\n\n`;
    }
  });
  return { text, isStoryOver };
}

export type AutoplayDecision =
  | {
      reasoning: string;
      choice: string;
      storyOver: false;
      generationCost: number | null;
    }
  | {
      reasoning: string;
      choice: null;
      storyOver: true;
      generationCost: number | null;
    };

/** Asks the player AI for the next action (or an ending comment). */
export async function decideAutoplayTurn(params: {
  apiKey: string;
  textModel: string;
  game: GameRecord;
  nodes: StoryNodeRecord[];
  viewingNodeId: string;
  narrativeLanguage: string;
  signal?: AbortSignal;
}): Promise<AutoplayDecision> {
  const { text, isStoryOver } = buildAutoplayLog(params.game, params.nodes, params.viewingNodeId);
  const response = await new OpenAiCompatibleClient(params.apiKey).createChatCompletion(
    {
      model: parseTextModelOptions(params.textModel).model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "autoPlay",
          strict: true,
          schema: z.toJSONSchema(isStoryOver ? autoplayEndingSchema : autoplayDecisionSchema),
        },
      } as never,
      messages: [
        { role: "system", content: buildSystemPrompt(params.narrativeLanguage, isStoryOver) },
        { role: "user", content: text },
      ],
    },
    { signal: params.signal },
  );
  const raw = response.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new Error("Player AI returned no content.");
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error("Player AI returned invalid JSON", { cause: error });
  }

  if (isStoryOver) {
    const parsed = autoplayEndingSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error(
        `Player AI response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
      );
    }
    if (parsed.data.reasoning.trim().length === 0) {
      throw new Error("Player AI returned an empty retrospective comment.");
    }
    return {
      reasoning: parsed.data.reasoning,
      choice: null,
      storyOver: true,
      generationCost: response.usage?.cost ?? null,
    };
  }

  const parsed = autoplayDecisionSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(
      `Player AI response failed validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  if (parsed.data.choice.trim().length === 0) {
    throw new Error("Player AI returned an empty choice.");
  }
  return {
    reasoning: parsed.data.reasoning,
    choice: parsed.data.choice,
    storyOver: false,
    generationCost: response.usage?.cost ?? null,
  };
}
