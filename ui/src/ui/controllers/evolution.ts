import { extractText } from "../chat/message-extract.ts";
import { sendChatMessage, type ChatState } from "./chat.ts";

export const EVOLUTION_SESSION_KEY = "evolution:main";

const STUDENT_MODE_PREAMBLE = `[System: You are in Student Mode. You are a student learning to complete tasks.
The user is your teacher. When you are unsure which skill or tool to use, ASK the teacher.
Do not assume — always clarify. After completing the task, await further instructions.]

`;

const EVOLUTION_TRIGGER_PROMPT = `[EVOLUTION TRIGGER] Based on our conversation above, please:
1. Identify skills used or new skills that should be created (provide SKILL.md content for each)
2. Suggest optimizations to existing workspace skills
3. Identify key learnings to store as memory

Format your response as JSON:
{
  "skills": [{"name": "skill-name", "description": "what it does", "content": "SKILL.md content"}],
  "optimizations": [{"skill": "existing-skill-name", "suggestion": "what to improve"}],
  "memories": [{"key": "topic", "value": "what was learned"}]
}`;

// Minimal evolution-specific state — chat state is reused from the main ChatState
export type EvolutionExtraState = {
  evolutionTaskStatus: "idle" | "in-progress" | "complete" | "evolving" | "evolved";
  evolutionResults: Array<{ kind: string; detail: string }>;
  evolutionError: string | null;
};

/**
 * Send a message in evolution mode. Prepends student-mode preamble on first message.
 * Expects state.sessionKey to already be set to EVOLUTION_SESSION_KEY.
 */
export async function sendEvolutionMessage(
  state: ChatState & EvolutionExtraState,
  message: string,
): Promise<string | null> {
  const isFirstMessage = state.evolutionTaskStatus === "idle" && state.chatMessages.length === 0;
  const fullMessage = isFirstMessage ? STUDENT_MODE_PREAMBLE + message : message;

  if (state.evolutionTaskStatus === "idle") {
    state.evolutionTaskStatus = "in-progress";
  }

  return sendChatMessage(state, fullMessage);
}

export function markEvolutionTaskComplete(state: EvolutionExtraState): void {
  if (state.evolutionTaskStatus === "in-progress") {
    state.evolutionTaskStatus = "complete";
  }
}

/**
 * Trigger evolution by sending a structured prompt. Parses the response later
 * when the final event arrives (called from the view or app layer).
 */
export async function triggerEvolution(state: ChatState & EvolutionExtraState): Promise<void> {
  if (state.evolutionTaskStatus !== "complete") {
    return;
  }
  state.evolutionTaskStatus = "evolving";
  state.evolutionResults = [];
  state.evolutionError = null;

  await sendChatMessage(state, EVOLUTION_TRIGGER_PROMPT);
}

/**
 * Called after a final chat event when evolutionTaskStatus === "evolving".
 * Parses the last assistant message for structured evolution results.
 */
export function parseEvolutionResults(state: ChatState & EvolutionExtraState): void {
  const lastMessage = state.chatMessages[state.chatMessages.length - 1];
  const results: Array<{ kind: string; detail: string }> = [];

  let text = "";
  if (lastMessage && typeof lastMessage === "object") {
    const entry = lastMessage as Record<string, unknown>;
    if (typeof entry.text === "string") {
      text = entry.text;
    } else {
      const extracted = extractText(lastMessage);
      if (typeof extracted === "string") {
        text = extracted;
      }
    }
  }

  const jsonMatch = /\{[\s\S]*"skills"[\s\S]*\}/.exec(text);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        skills?: Array<{ name?: string; description?: string }>;
        optimizations?: Array<{ skill?: string; suggestion?: string }>;
        memories?: Array<{ key?: string; value?: string }>;
      };
      for (const s of parsed.skills ?? []) {
        results.push({ kind: "skill-generated", detail: s.name ?? s.description ?? "New skill" });
      }
      for (const o of parsed.optimizations ?? []) {
        results.push({
          kind: "skill-optimized",
          detail: o.skill ?? o.suggestion ?? "Optimization",
        });
      }
      for (const m of parsed.memories ?? []) {
        results.push({ kind: "memory-stored", detail: m.key ?? m.value ?? "Memory entry" });
      }
    } catch {
      results.push({ kind: "memory-stored", detail: "Evolution analysis complete (see chat)" });
    }
  } else if (text.trim()) {
    results.push({ kind: "memory-stored", detail: "Evolution analysis complete (see chat)" });
  }

  state.evolutionResults = results;
  state.evolutionTaskStatus = "evolved";
}

export function resetEvolution(state: EvolutionExtraState): void {
  state.evolutionTaskStatus = "idle";
  state.evolutionResults = [];
  state.evolutionError = null;
}
