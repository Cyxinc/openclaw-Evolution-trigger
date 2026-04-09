import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import { icons } from "../icons.ts";
import { renderChat, type ChatProps } from "./chat.ts";

export type EvolutionProps = {
  chatProps: ChatProps;
  taskStatus: "idle" | "in-progress" | "complete" | "evolving" | "evolved";
  evolving: boolean;
  evolutionResults: Array<{ kind: string; detail: string }>;
  evolutionError: string | null;
  onMarkComplete: () => void;
  onEvolve: () => void;
  onReset: () => void;
};

function statusLabel(status: EvolutionProps["taskStatus"]): string {
  const key = {
    idle: "evolution.status.idle",
    "in-progress": "evolution.status.inProgress",
    complete: "evolution.status.complete",
    evolving: "evolution.status.evolving",
    evolved: "evolution.status.evolved",
  }[status];
  return t(key);
}

function resultIcon(kind: string) {
  switch (kind) {
    case "skill-generated":
      return icons.zap;
    case "skill-optimized":
      return icons.settings;
    case "memory-stored":
      return icons.brain;
    default:
      return icons.folder;
  }
}

function resultLabel(kind: string): string {
  switch (kind) {
    case "skill-generated":
      return t("evolution.results.skillGenerated");
    case "skill-optimized":
      return t("evolution.results.skillOptimized");
    case "memory-stored":
      return t("evolution.results.memoryStored");
    default:
      return kind;
  }
}

export function renderEvolution(props: EvolutionProps) {
  const { chatProps, taskStatus, evolving, evolutionResults, evolutionError } = props;

  const canMarkComplete = taskStatus === "in-progress" && !chatProps.sending;
  const canEvolve = taskStatus === "complete" && !evolving;
  const canReset =
    taskStatus === "evolved" || taskStatus === "complete" || taskStatus === "in-progress";

  return html`
    <div class="evolution-page">
      <!-- Banner -->
      <div class="evolution-banner">
        <div class="evolution-banner__icon">${icons.spark}</div>
        <div class="evolution-banner__text">
          <strong>${t("evolution.banner.title")}</strong>
          <span>${t("evolution.banner.subtitle")}</span>
        </div>
        <div class="evolution-banner__status">
          <span class="evolution-status evolution-status--${taskStatus}">
            ${statusLabel(taskStatus)}
          </span>
        </div>
      </div>

      <!-- Action bar -->
      <div class="evolution-actions">
        <button
          class="btn btn--subtle btn--sm"
          ?disabled=${!canMarkComplete}
          @click=${() => props.onMarkComplete()}
        >
          ${t("evolution.actions.markComplete")}
        </button>
        <button
          class="btn btn--primary btn--sm"
          ?disabled=${!canEvolve}
          @click=${() => props.onEvolve()}
        >
          ${evolving ? t("evolution.actions.evolving") : t("evolution.actions.evolve")}
        </button>
        <button
          class="btn btn--subtle btn--sm"
          ?disabled=${!canReset}
          @click=${() => props.onReset()}
        >
          ${t("evolution.actions.newTask")}
        </button>
        ${evolutionError ? html`<span class="evolution-error">${evolutionError}</span>` : nothing}
      </div>

      <!-- Evolution results (shown after evolution) -->
      ${evolutionResults.length > 0
        ? html`
            <div class="evolution-results">
              <h4 class="evolution-results__title">${t("evolution.results.title")}</h4>
              <ul class="evolution-results__list">
                ${evolutionResults.map(
                  (r) => html`
                    <li class="evolution-results__item">
                      <span class="evolution-results__icon">${resultIcon(r.kind)}</span>
                      <span class="evolution-results__kind">${resultLabel(r.kind)}</span>
                      <span class="evolution-results__detail">${r.detail}</span>
                    </li>
                  `,
                )}
              </ul>
            </div>
          `
        : nothing}

      <!-- Reuse the full chat view -->
      <div class="evolution-chat-wrapper">${renderChat(chatProps)}</div>
    </div>
  `;
}
